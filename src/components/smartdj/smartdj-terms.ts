/**
 * Plain-language definitions for Smart DJ terms of art.
 *
 * FE-local static copy on purpose: no server round-trip, the copy never
 * drifts with a command response. Keys are namespaced:
 *   - bare rule ids  (hard-requirements panel rows, e.g. "bpm_delta")
 *   - "style:<id>"   (transition technique tokens, e.g. "style:quick_cut")
 *   - "meta:<id>"    (analyzer metadata concepts, e.g. "meta:valence")
 */
export interface SmartDJTerm {
  label: string;
  definition: string;
}

export const SMART_DJ_TERMS: Record<string, SmartDJTerm> = {
  // --- hard-requirements rule ids ---
  bpm_delta: {
    label: "Tempo compatibility",
    definition:
      "How far apart two tracks' tempos are, as a percentage. The server nudges one track's speed to meet the other, but only inside a stretch budget: 6% strict / 8% normal / 12% aggressive beat matching, halved when either track has vocals. Past the budget the pair cannot be blended, so the plan rejects it.",
  },
  max_bpm_jump: {
    label: "Maximum BPM jump",
    definition:
      "The largest tempo change allowed between neighbouring tracks, before any speed nudging. Lower it for smoother sets; raise it for ragged live-style segues.",
  },
  bpm_range: {
    label: "BPM range",
    definition:
      "Your minimum and maximum BPM controls. Tracks outside the window are excluded before planning; widen the range if the whole queue keeps failing here.",
  },
  key_incompatible: {
    label: "Key compatibility",
    definition:
      "How well two tracks' musical keys sit together, scored in Camelot-style tiers (1.0, 0.85, 0.72, 0.55, 0). A zero-tier pair clashes harmonically, so the planner refuses it.",
  },
  energy: {
    label: "Energy step",
    definition:
      "Energy is the analyzer's 0-1 intensity score. The plan limits how big a jump it makes from one track to the next; the hard gate blocks any pair swinging more than 0.35 on that scale.",
  },
  energy_step: {
    label: "Energy step",
    definition:
      "Energy is the analyzer's 0-1 intensity score. The plan limits how big a jump it makes from one track to the next; the hard gate blocks any pair swinging more than 0.35 on that scale.",
  },
  danceability: {
    label: "Danceability step",
    definition:
      "How much a track makes people want to dance, from the analyzer. Big danceability swings between neighbours feel like a record skip, so the step is limited.",
  },
  loudness: {
    label: "Loudness step",
    definition:
      "Perceived volume, measured from the track's RMS. A sudden loud jump startles the room, so the planner caps the loudness change between consecutive tracks.",
  },
  genre: {
    label: "Genre compatibility",
    definition:
      "The style pin (house, hip-hop, rock, …) attached to each track. Very different genre pins get restricted transition styles and tighter tempo budgets.",
  },
  artist_spacing: {
    label: "Artist spacing",
    definition:
      "How many tracks by the same artist may play back-to-back (default 1). Keeps the mix from sounding like one artist's album.",
  },
  instrumental: {
    label: "Instrumental preference",
    definition:
      "Whether the mix prefers tracks without vocals. 'Required' excludes vocal tracks entirely.",
  },
  explicit: {
    label: "Explicit content",
    definition:
      "Whether tracks flagged explicit may appear in the mix. 'Exclude' removes them from planning.",
  },
  excluded: {
    label: "Excluded track",
    definition:
      "This track was marked excluded in the queue, so the plan leaves it out by design.",
  },

  // --- transition technique tokens (transition reports) ---
  "style:auto": {
    label: "Auto",
    definition:
      "The server picks the transition style for each pair from what the two tracks allow.",
  },
  "style:full_blend": {
    label: "Blend",
    definition:
      "Both tracks play together and crossfade across the whole transition — the outgoing record dissolves underneath the incoming one.",
  },
  "style:blend": {
    label: "Blend",
    definition:
      "The outgoing track fades under the incoming one across an overlapping transition.",
  },
  "style:energy": {
    label: "Energy",
    definition:
      "The transition style is chosen to push the room's energy in the direction the mix is programmed to travel.",
  },
  "style:quick_cut": {
    label: "Quick cut",
    definition:
      "No overlap: the outgoing track stops on the phrase and the next one starts clean. Right for hip-hop, pop, rock and funk; wrong for long blends.",
  },
  "style:radio": {
    label: "Radio",
    definition:
      "A short DJ-style overlap: the incoming track starts over the outgoing one's tail, then takes over within a couple of bars.",
  },
  "style:echo_out": {
    label: "Echo-out",
    definition:
      "The outgoing track's tail repeats into echoes while the next track starts clean underneath — a way out that needs no beatmatching room.",
  },
  "style:filter_out": {
    label: "Filter-out",
    definition:
      "The outgoing track's sound is filtered away — tops first, then bass — until only the incoming track remains.",
  },
  "style:cut": {
    label: "Cut",
    definition: "The outgoing track stops immediately; no overlap, no blend.",
  },

  // --- analyzer metadata concepts ---
  "meta:vocal_density": {
    label: "Both vocal",
    definition:
      "How much of a track carries vocals. When both tracks at a boundary are vocal, the tempo-stretch budget is halved and blends get careful — two voices fight for the same space.",
  },
  "meta:valence": {
    label: "Valence",
    definition:
      "The analyzer's 0-1 happiness score for a track — low reads dark or sad, high reads bright or happy. Stored for mood programming.",
  },
  "meta:arousal": {
    label: "Arousal",
    definition:
      "The analyzer's 0-1 intensity-of-feeling score — low is calm, high is exciting. Stored for mood programming.",
  },
  "meta:phrase": {
    label: "Phrase",
    definition:
      "A repeating block of bars (typically 8 or 16) that structures a track. Transitions that start and end on phrase boundaries sound intentional.",
  },
};

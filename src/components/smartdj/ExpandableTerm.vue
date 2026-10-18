<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown } from "@lucide/vue";
import { SMART_DJ_TERMS } from "./smartdj-terms";

const props = defineProps<{
  // dictionary key in smartdj-terms.ts — a rule id ("bpm_delta"), a
  // technique token ("style:quick_cut"), or a metadata concept
  // ("meta:valence")
  termKey: string;
  // shown instead of the tappable label when no definition exists
  fallback: string;
}>();

const expanded = ref(false);
const entry = computed(() => SMART_DJ_TERMS[props.termKey]);
</script>

<template>
  <span v-if="!entry">{{ fallback }}</span>
  <div v-else class="min-w-0">
    <button
      type="button"
      class="flex w-full items-center gap-1.5 text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <ChevronDown
        class="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
        :class="expanded ? 'rotate-180' : ''"
        aria-hidden="true"
      />
      <span
        class="min-w-0 break-words underline decoration-dotted underline-offset-2"
      >
        {{ entry.label || fallback }}
      </span>
    </button>
    <div
      class="grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out"
      :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="min-h-0 overflow-hidden">
        <p class="mt-1 break-words text-xs text-muted-foreground">
          {{ entry.definition }}
        </p>
      </div>
    </div>
  </div>
</template>

'use strict';

const { validateTagName } = require('./macros-store.cjs');

const TAG_IN_PROMPT_RE = /\{\{([a-z0-9-]{1,32})\}\}/g;

/**
 * @param {string} prompt
 * @param {Record<string, { value?: string }>|null|undefined} macrosMap
 * @returns {{ text: string, missedTags: string[] }}
 */
function expandPrompt(prompt, macrosMap) {
  const map = macrosMap && typeof macrosMap === 'object' ? macrosMap : {};
  const missed = new Set();
  const text = String(prompt).replace(TAG_IN_PROMPT_RE, (full, tag) => {
    if (!validateTagName(tag)) {
      missed.add(tag);
      return full;
    }
    const entry = map[tag];
    const val = entry && typeof entry.value === 'string' ? entry.value : null;
    if (val == null) {
      missed.add(tag);
      return full;
    }
    return val;
  });
  return { text, missedTags: [...missed] };
}

module.exports = { expandPrompt };

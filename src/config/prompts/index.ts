// LLM Prompts Configuration
// Optimized for Royal Road / LitRPG / Fantasy Web Fiction
// Designed for compatibility with weaker/free LLMs (verbose, explicit instructions)
// Structure: XML tags for organization, chain-of-thought guidance, extensive examples

import { extractPrompt } from './extract';
import { mergePrompt } from './merge';
import { assignPrompt } from './assign';

export const LLM_PROMPTS = {
  extract: extractPrompt,
  merge: mergePrompt,
  assign: assignPrompt,
};

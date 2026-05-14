// ── Hibiki Engine Orchestrator v12 ────────────────────────────────────────────

export { BEHAVIOURAL_ENGINE } from './behaviouralEngine'
export { analyzeAndUpdateEmotion, getRuntimeModifiers, applyBehaviourOverride, resetEmotionalState, getEmotionalState } from './emotionalEngine'
export { buildLangMirrorDirective } from './langMirror'
export { analyzeAndBuildStyleDirective, resetStyleState } from './styleEngine'
export { detectAndBuildTransitionDirective, resetTransitionState } from './transitionManager'
export { updateRelationshipProgress, getRelationshipDirective, resetRelationshipState, getRelState } from './relationshipEngine'

import { BEHAVIOURAL_ENGINE } from './behaviouralEngine'
import { analyzeAndUpdateEmotion, getRuntimeModifiers, resetEmotionalState } from './emotionalEngine'
import { buildLangMirrorDirective } from './langMirror'
import { analyzeAndBuildStyleDirective, resetStyleState } from './styleEngine'
import { detectAndBuildTransitionDirective, resetTransitionState } from './transitionManager'
import { getRelationshipDirective, resetRelationshipState } from './relationshipEngine'

const SEP = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n'

export function orchestrateEngine(chatId, userMessage, history) {
  analyzeAndUpdateEmotion(chatId, userMessage)
  const emotional    = getRuntimeModifiers(chatId)
  const relationship = getRelationshipDirective(chatId)
  const langMirror   = buildLangMirrorDirective(history)
  const style        = analyzeAndBuildStyleDirective(chatId, history)
  const transition   = detectAndBuildTransitionDirective(chatId, history)
  const parts = [emotional, relationship, langMirror, style]
  if (transition) parts.push(transition)
  return parts.join(SEP)
}

export function resetAllEngineState(chatId) {
  resetEmotionalState(chatId)
  resetStyleState(chatId)
  resetTransitionState(chatId)
  resetRelationshipState(chatId)
}

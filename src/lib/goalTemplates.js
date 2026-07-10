// Default goal-template bank (spec §6): ≥8 per priority domain.
// Slots: {accuracy}, {cueLevel}, {sessions} are auto-bound to the target
// criterion in the goal builder; all other slots get their own inputs.

const RECEPTIVE = [
  'Will follow {steps}-step directions containing {conceptType} concepts with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will identify {skill} from a field of {fieldSize} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will answer {whType} questions about a {textType} presented {presentation} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will point to items illustrating {vocabularySet} vocabulary from a field of {fieldSize} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will identify {storyElements} after listening to a {textType} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will demonstrate understanding of {grammaticalForm} by selecting the matching picture with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will identify the item that does not belong in a category group of {fieldSize} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will follow classroom directions containing {conceptType} concepts within the classroom routine with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.'
]

const EXPRESSIVE = [
  'Will produce {structure} in {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will retell a narrative including {storyGrammarElements} given {cueLevel} cues in {count} of {opportunities} opportunities across {sessions} consecutive sessions.',
  'Will define or describe {skill} using {attributeCount} or more attributes with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use targeted {vocabularySet} vocabulary words in sentences during {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will produce grammatically complete sentences of {wordCount} or more words during {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will answer {whType} questions using complete sentences during {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use {conjunctions} to combine sentences during {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will state {sequenceLength}-step sequences to describe familiar routines with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.'
]

const ARTICULATION = [
  'Will produce {phonemes} in the {position} position at the {level} level with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will reduce use of {phonologicalProcess} to below {percentOpportunities}% of opportunities given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will self-monitor and self-correct target sound errors in {context} in {count} of {opportunities} opportunities given {cueLevel} cues.',
  'Will produce consonant clusters containing {phonemes} at the {level} level with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will produce multisyllabic words of {syllableCount} syllables maintaining all sounds with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will discriminate correct versus incorrect productions of {phonemes} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will produce {phonemes} in the {position} position during structured conversation with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use {strategy} strategies to improve overall speech intelligibility during {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.'
]

const SOCIAL = [
  'Will initiate and maintain a topic for {turns} conversational turns with {cueLevel} cues in {count} of {opportunities} opportunities.',
  'Will identify expected and unexpected behaviors in {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will interpret nonliteral language ({nonliteralType}) with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use repair strategies when a communication breakdown occurs in {count} of {opportunities} opportunities given {cueLevel} cues.',
  'Will identify the feelings and perspective of others in {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use appropriate greetings and farewells with peers and adults in {count} of {opportunities} opportunities given {cueLevel} cues.',
  'Will make on-topic comments and ask related questions during peer interactions with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will match tone of voice, facial expression, and body language to the situation in {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.'
]

// Generic templates for fluency / voice / other (spec §4).
const GENERIC = [
  'Will demonstrate {skill} in {context} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will use {strategy} strategies during {context} in {count} of {opportunities} opportunities given {cueLevel} cues.',
  'Will identify and describe {skill} with {accuracy}% accuracy given {cueLevel} cues across {sessions} consecutive sessions.',
  'Will independently apply {strategy} techniques during {context} across {sessions} consecutive sessions.',
  'Will meet an individualized target for {skill} in {count} of {opportunities} opportunities given {cueLevel} cues.'
]

const BANK = {
  'receptive-language': RECEPTIVE,
  'expressive-language': EXPRESSIVE,
  'articulation-phonology': ARTICULATION,
  'social-pragmatic': SOCIAL,
  fluency: GENERIC,
  voice: GENERIC,
  other: GENERIC
}

export function getTemplates(domain) {
  return (BANK[domain] ?? GENERIC).map((text, i) => ({ id: `${domain}-${i}`, text }))
}

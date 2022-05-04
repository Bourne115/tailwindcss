type CandidateTypes =
  | { type: 'property'; name: string; value: string }
  | { type: 'utility'; name: string }
  | { type: 'custom'; name: string; value: string }

type CandidateCommon = {
  raw: string
  prefix: string
  negative: boolean
  variants: CandidateVariant[]
  modifiers: CandidateModifier[]
}

export type CandidateVariant = string | { source: 'custom'; value: string }
export type CandidateModifier = string | { source: 'custom'; value: string }

export type Candidate = CandidateCommon & CandidateTypes

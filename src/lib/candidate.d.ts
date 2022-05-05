type CandidateTypes =
  | { type: 'property'; name: string; value: string }
  | { type: 'utility'; name: string }
  | { type: 'custom'; name: string; value: string; valueType: DataType }

type CandidateCommon = {
  raw: string
  withoutVariants: string // TODO: remove this
  prefix: string
  negative: boolean
  variants: CandidateVariant[]
  modifiers: CandidateModifier[]
}

export type CandidateVariant = string | { type: 'custom'; value: string }
export type CandidateModifier = string | { type: 'custom'; value: string }

export type Candidate = CandidateCommon & CandidateTypes

export type DataType =
  | 'any'
  | 'color'
  | 'url'
  | 'image'
  | 'length'
  | 'percentage'
  | 'position'
  | 'lookup'
  | 'generic-name'
  | 'family-name'
  | 'number'
  | 'line-width'
  | 'absolute-size'
  | 'relative-size'
  | 'shadow'

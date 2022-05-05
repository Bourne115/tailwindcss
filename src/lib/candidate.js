// @ts-check

/** @typedef {import('./candidate.d').Candidate} Candidate */
/** @typedef {import('./candidate.d').DataType} DataType */
/** @typedef {import('./candidate.d').CandidateVariant} CandidateVariant */
/** @typedef {import('./candidate.d').CandidateModifier} CandidateModifier */

import { normalize } from '../util/dataTypes.js'
import isValidArbitraryValue from '../util/isValidArbitraryValue.js'
import { isParsableCssValue } from './generateRules.js'

/** @type {Map<string, Candidate>} */
let candidateCache = new Map()

/**
 *
 * @param {string} raw
 * @param {any} context
 * @returns {Candidate | null}
 */
export function parseCandidate(raw, context) {
  let candidate = candidateCache.get(raw)

  if (!candidate) {
    candidate = parseRawCandidate(raw, context)
    candidateCache.set(raw, candidate)
  }

  return candidate
}

/**
 *
 * @param {string} raw
 * @param {any} context
 * @returns {Candidate | null}
 */
function parseRawCandidate(raw, context) {
  let candidate = parseStructure(raw, context)

  if (!candidate) {
    return null
  }

  // Ignore invalid custom property names
  if (candidate.type === 'property' && !isValidPropName(candidate.name) && !isParsableCssValue(candidate.name, candidate.value)) {
    return null
  }

  // Ignore url-like custom properties
  if (candidate.type === 'property' && looksLikeUri(`${candidate.name}:${candidate.value}`)) {
    return null
  }

  // Ignore invalid arbitrary values
  if (candidate.type === 'custom' && !isValidArbitraryValue(candidate.value)) {
    return null
  }

  // Normalize custom property values and arbitrary values
  if (candidate.type === 'custom' || candidate.type === 'property') {
    candidate.value = normalize(candidate.value)
  }

  return candidate
}

/**
 *
 * @param {string} raw
 * @param {any} context
 * @returns {Candidate | null}
 */
function parseStructure(raw, context) {
  let separator = context.tailwindConfig.separator
  let VARIANT_SEPARATOR_PATTERN = new RegExp(`\\${separator}(?![^[]*\\])`, 'g')

  // Parse out the variants
  let [candidate, ...rawVariants] = raw.split(VARIANT_SEPARATOR_PATTERN).reverse()
  let withoutVariants = candidate
  let variants = rawVariants.reverse().map(parseVariant)

  // Important?
  let important = candidate[0] === '!'
  if (important) {
    candidate = candidate.slice(1)
  }

  // Negative before prefix
  let negative = false
  if (candidate[0] === '-') {
    negative = true
    candidate = candidate.slice(1)
  }

  // Skip (but verify) the prefix

  // Negative after prefix
  if (candidate[0] === '-') {
    negative = true
    candidate = candidate.slice(1)
  }

  // Modifier at the end
  let rawModifiers = parseModifiers(candidate)

  /** @type {CandidateModifier[]} */
  let modifiers = []
  if (rawModifiers) {
    candidate = rawModifiers[0]
    modifiers = [rawModifiers[1]]
  } else {
    modifiers = []
  }

  let common = {
    raw,
    withoutVariants,

    // This is always gonna be the same
    // but is included for completeness
    prefix: context.tailwindConfig.prefix ?? '',
    important,
    variants,
    negative,
    modifiers,
  }

  // Scan for the name up to the modifier, opening aribtrary value bracket, or end of string

  let arbitraryProperty = parseArbitraryProperty(candidate)
  if (arbitraryProperty) {
    return Object.assign(common, {
      /** @type {'property'} */
      type: 'property',
      name: arbitraryProperty[0],
      value: arbitraryProperty[1],
    })
  }

  let arbitraryValue = parseArbitraryValue(candidate)
  if (arbitraryValue) {
    return Object.assign(common, {
      /** @type {'custom'} */
      type: 'custom',
      name: arbitraryValue[0],
      value: arbitraryValue[1],
      valueType: arbitraryValue[2],
    })
  }

  return Object.assign(common, {
    /** @type {'utility'} */
    type: 'utility',
    name: candidate,
  })
}

/**
 *
 * @param {string} str
 * @returns {[string, string] | null}
 */
function parseArbitraryProperty(str) {
  let [, property, value] = str.match(/^\[([a-zA-Z0-9-_]+):(\S+)\]$/) ?? []

  if (value === undefined) {
    return null
  }

  return [property, value]
}

/**
 *
 * @param {string} raw
 * @returns {[string, string, DataType] | null}
 */
function parseArbitraryValue(raw) {
  let arbitraryStart = raw.indexOf('-[')
  if (arbitraryStart === -1) {
    return null
  }

  if (raw[raw.length - 1] !== ']') {
    return null
  }

  let dataTypeSeparator = raw.indexOf(':')
  if (dataTypeSeparator === -1) {
    return [
      raw.slice(0, arbitraryStart),
      raw.slice(arbitraryStart + 2, -1),
      'any'
    ]
  }

  return [
    raw.slice(0, arbitraryStart),
    raw.slice(dataTypeSeparator + 1, -1),
    // @ts-ignore
    raw.slice(arbitraryStart + 2, dataTypeSeparator),
  ]
}

/**
 *
 * @param {string} raw
 * @returns {CandidateVariant}
 */
function parseVariant(raw) {
  if (raw[0] === '[' && raw[raw.length - 1] === ']') {
    return {
      /** @type {'custom'} */
      type: 'custom',
      value: raw.slice(1, -1),
    }
  }

  return raw
}

/**
 *
 * @param {string} raw
 * @returns {[string, CandidateModifier] | null}
 */
function parseModifiers(raw) {
  let match = raw.match(/\/\[([^\[\]]+)\]|\/([^\[\]]+)$/) ?? []

  if (match.length === 0) {
    return null
  }

  if (match[1] !== undefined) {
    return [
      raw.slice(0, match.index),
      {
        type: 'custom',
        value: match[1],
      },
    ]
  }

  if (match[2] !== undefined) {
    return [raw.slice(0, match.index), match[2]]
  }

  return null
}

const IS_VALID_PROPERTY_NAME = /^[a-z_-]/

function isValidPropName(name) {
  return IS_VALID_PROPERTY_NAME.test(name)
}

/**
 * @param {string} declaration
 * @returns {boolean}
 */
function looksLikeUri(declaration) {
  // Quick bailout for obvious non-urls
  // This doesn't support schemes that don't use a leading // but that's unlikely to be a problem
  if (!declaration.includes('://')) {
    return false
  }

  try {
    const url = new URL(declaration)
    return url.protocol !== '' && url.host !== ''
  } catch (err) {
    // Definitely not a valid url
    return false
  }
}

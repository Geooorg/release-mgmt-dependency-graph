import { createTranslate } from '../i18n/translate'
import type { Translate } from '../i18n/translate'
import { toTriples } from '../model/rdfExport'
import { modelFromTriples } from '../model/rdfImport'
import { NS, blank, iri } from '../model/rdfTerms'
import type { Literal, Subject, Term, Triple } from '../model/rdfTerms'
import { serializeModel } from '../model/serialize'
import type { GraphContent } from '../model/types'

/**
 * Turtle reading and writing. The only place that uses `n3`, loaded on demand so the main bundle stays small.
 * The model code works on its own minimal triples (`model/rdfTerms.ts`); this file converts.
 */

const PREFIXES = { rm: NS.rm, rdf: NS.rdf, rdfs: NS.rdfs, xsd: NS.xsd, dcterms: NS.dcterms }

/** A project file is either the JSON model (starts with `{`) or Turtle. */
export function looksLikeJson(text: string): boolean {
  return text.trimStart().startsWith('{')
}

export async function triplesToTurtle(triples: readonly Triple[]): Promise<string> {
  const { Writer, DataFactory } = await import('n3')
  const { namedNode, blankNode, literal, quad } = DataFactory
  const subjectOf = (subject: Subject) => (subject.termType === 'NamedNode' ? namedNode(subject.value) : blankNode(subject.value))
  const objectOf = (object: Term) => {
    if (object.termType === 'NamedNode') return namedNode(object.value)
    if (object.termType === 'BlankNode') return blankNode(object.value)
    return literal(object.value, namedNode(object.datatype))
  }
  const writer = new Writer({ prefixes: PREFIXES })
  for (const triple of triples) {
    writer.addQuad(quad(subjectOf(triple.subject), namedNode(triple.predicate.value), objectOf(triple.object)))
  }
  return new Promise((resolve, reject) => {
    writer.end((error, result) => (error || result === undefined ? reject(error ?? new Error('Turtle writer returned no output')) : resolve(result)))
  })
}

export type TurtleParse = { ok: true; triples: Triple[] } | { ok: false; reason: string }

/** Parses Turtle (also N-Triples). A syntax error is a result; failing to load the parser is an exception. */
export async function parseTurtle(text: string): Promise<TurtleParse> {
  const { Parser } = await import('n3')
  let quads
  try {
    quads = new Parser({ format: 'Turtle' }).parse(text)
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  const triples: Triple[] = []
  for (const quad of quads) {
    if (quad.graph.termType !== 'DefaultGraph' || quad.predicate.termType !== 'NamedNode') continue
    const subject = quad.subject.termType === 'NamedNode' ? iri(quad.subject.value) : quad.subject.termType === 'BlankNode' ? blank(quad.subject.value) : undefined
    let object: Term | undefined
    if (quad.object.termType === 'NamedNode') object = iri(quad.object.value)
    else if (quad.object.termType === 'BlankNode') object = blank(quad.object.value)
    else if (quad.object.termType === 'Literal') {
      const literal: Literal = { termType: 'Literal', value: quad.object.value, datatype: quad.object.datatype.value }
      object = literal
    }
    if (subject !== undefined && object !== undefined) triples.push({ subject, predicate: iri(quad.predicate.value), object })
  }
  return { ok: true, triples }
}

export async function exportTurtle(content: GraphContent): Promise<string> {
  return triplesToTurtle(toTriples(content))
}

export type TurtleImport = { ok: true; json: string } | { ok: false; errors: string[] }

/**
 * Turtle text -> the JSON text of the model, ready for the store's `importText`. Everything the model rules reject
 * comes back as `errors`; only a failure to load the parser throws.
 */
export async function turtleToModelJson(text: string, t: Translate = createTranslate('de')): Promise<TurtleImport> {
  const parsed = await parseTurtle(text)
  if (!parsed.ok) return { ok: false, errors: [t('rdf.error.syntax', { reason: parsed.reason })] }
  const result = modelFromTriples(parsed.triples, t)
  if (!result.ok) return { ok: false, errors: result.errors }
  return { ok: true, json: serializeModel(result.model) }
}

// Banco_Conocimientos_C2_KWT_Actualizado.pdf (banco personal: KWT y Word Formation) — 2026-10-29
// Ya estaban en el banco (no se duplican): Were it not for, On condition that, Put something down to,
// Under the weather. A los dos últimos se les subió la prioridad en sus archivos.
import { deck } from '../lib/flash.mjs';

const structure = deck(['inversion', 'conditional'], ['P4']);
const linker = deck(['conditional', 'linking'], ['P2', 'P4']);
const idiom = deck('idiom', ['P1', 'P4']);
const wf = deck('word_formation', ['P3']);
const src = 'Banco KWT';

export default [
  structure('{{Were}} + subject + to + infinitive, …', 'if, hypothetically, … (formal inversion)', '{{Were}} the government {{to}} raise taxes, there would be protests.', { src, prio: 3 }),
  idiom('let nature take its {{course}}', 'allow things to happen without interfering', 'The doctor told us to rest and {{let nature take its course}}.', { src, prio: 3 }),
  linker('so {{long}} as + clause', 'only on condition that', 'You can borrow my car {{so long as}} you bring it back by six.', { src, prio: 3 }),

  wf('the {{rationale}} behind + noun / -ing', 'the reasons for a decision or plan', 'Nobody understood {{the rationale behind}} the decision.', { src, prio: 3, root: 'RATIONAL' }),
  wf('vanish {{inexplicably}}', 'for no reason anyone can understand', 'The documents {{vanished inexplicably}} from the archive.', { src, prio: 3, root: 'EXPLAIN' }),
  wf('listed in the {{appendices}}', 'extra sections at the end of a book (plural)', 'The full results are {{listed in the appendices}}.', { src, prio: 3, root: 'APPENDIX' }),
  wf('be {{receptive}} to', 'willing to listen to and consider', 'The board {{was receptive to}} our proposal.', { src, prio: 3, root: 'RECEIVE' }),
  wf('{{philosophical}} considerations', 'questions about meaning and values', 'The debate raised serious {{philosophical considerations}}.', { src, prio: 3, root: 'PHILOSOPHY' }),
  wf('a {{sobering}} reminder of', 'something that makes you serious and thoughtful', 'The accident was {{a sobering reminder of}} the dangers of speeding.', { src, prio: 3, root: 'SOBER' }),
  wf('{{tasteless}} trinkets', 'cheap, vulgar little souvenirs', 'The stalls sold nothing but {{tasteless trinkets}}.', { src, prio: 3, root: 'TASTE' }),
  wf('profoundly {{disrespectful}} to', 'deeply rude and insulting towards', 'His remarks were {{profoundly disrespectful to}} the victims.', { src, prio: 3, root: 'RESPECT' }),
  wf('{{thoughtfully}} designed', 'planned with great care for the user', 'The kitchen is small but {{thoughtfully designed}}.', { src, prio: 3, root: 'THOUGHT' }),
  wf('leave someone {{humbled}}', 'make someone feel less proud', 'Meeting the survivors {{left him humbled}}.', { src, prio: 3, root: 'HUMBLE' }),
];

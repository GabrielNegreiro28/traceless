/**
 * Invented demo report for the "Try a sample report" button. Every person, place and
 * event is fictional. It deliberately carries several details that could identify its
 * writer (unique role, schedule, location, tenure, sign-off) next to the accused's name
 * and title and some incident facts, so the scan has something realistic to find.
 * Written independently of the evaluation dataset (a test guards against overlap).
 *
 * It lives in the domain because the consented cloud scan treats it specially: being
 * fictional, the unmodified sample may be analyzed in the cloud after one click.
 */
export const SAMPLE_REPORT = `I am the only night-shift forklift trainer at the Halvern Freight depot in Brackenford, Dock 4. I have held this job for six years, so most of the crew knows me by sight.

On the night of 14 March, at about 2 a.m., I watched Gary Pemberton, the operations manager, tell two temporary workers to load pallets of damaged lithium batteries onto a trailer without the fire-safety labels the law requires. When I objected, he said the paperwork could be fixed later and that the trailer had to leave before dawn. The same thing happened again on 28 March.

I work Tuesday to Saturday, from 10 p.m. to 6 a.m., and I sign the dock safety checklist at the start of every shift, so my name is on the logs for both nights. I told my shift supervisor the following Monday and nothing changed.

I am writing because somebody is going to get hurt. Please do not share this with anyone at the depot.

Thanks for listening,
the tired trainer on the night shift`;

/**
 * True only for the built-in fictional sample, character for character. One edited
 * character makes it the reporter's own text, which needs the full cloud consent.
 */
export function isUnmodifiedSample(text: string): boolean {
  return text === SAMPLE_REPORT;
}

import { SR5 } from '@/module/config';

// Sorting of the redesigned sheets' tables: the skill tables and the card tables of the item tabs (column headers,
// the tab's sort button). What a cell sorts by, and how two cells compare (SR5CharacterSheetRedesign).

// active skills, languages + knowledge (one table), and each matrix action table (`matrix_<limit>`)
export type SkillTable = 'active' | 'knowledge' | `matrix_${string}`;
export type SkillSortKey = 'name' | 'attr' | 'rtg' | 'pool' | 'marks' | 'type';
/** Sort of one table: a column ('name', a skill key, or `col<index>` of a card table) and its direction. */
export interface TableSort { key: string; dir: 'asc' | 'desc' }
/** A cell as a card table sorts it: a number (Drain 'F − 1' is −1), a rank (action types), or text; null when empty. */
export type SortValue = { number: number; ranked: boolean } | { text: string } | null;
export const NUMERIC_SORT_KEYS = new Set<SkillSortKey>(['rtg', 'pool', 'marks', 'type']);
/** Sorted A-Z / lowest first on the first click (the other columns start with the highest). */
export const ASCENDING_SORT_KEYS = new Set<SkillSortKey>(['attr', 'type']);
/** Action type order for sorting: the cheapest action first. */
export const ACTION_TYPE_ORDER = ['free', 'simple', 'complex', 'interrupt', 'varies'];

/** The cell of a card row a sort key reads: the name, or the column at the header's position. */
export function sortCell(row: HTMLElement, key: string): HTMLElement | null {
    const item = row.querySelector<HTMLElement>(':scope > .list-item');
    if (!item) return null;
    if (key === 'name') return item.querySelector<HTMLElement>(':scope > .list-item-start .item-name-link, :scope > .list-item-start .item-name')
        ?? item.querySelector<HTMLElement>(':scope > .list-item-start');
    return item.querySelectorAll<HTMLElement>(':scope > .list-item-col')[Number(key.slice(3))] ?? null;
}

/**
 * What a cell sorts by: a number when it shows one ('¥ 1,500', 'F − 1' → −1, a lone 'F' or 'L' → 0), the cost order
 * of an action type, otherwise its text. Fields in edit mode sort by their value; empty cells and dashes go last.
 */
export function sortValue(cell: HTMLElement | null, key?: string): SortValue {
    if (!cell) return null;
    // names sort as text: 'HK-227' or 'Medkit (Rating 6)' are no numbers
    if (key === 'name') {
        const name = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
        return name ? { text: name } : null;
    }
    const field = cell.querySelector<HTMLInputElement | HTMLSelectElement>('input:not([type="hidden"]), select');
    const raw = field instanceof HTMLSelectElement ? field.selectedOptions[0]?.textContent ?? '' : field ? field.value : cell.textContent ?? '';
    const text = raw.replace(/[\u2212\u2013]/g, '-').replace(/\s+/g, ' ').trim();
    if (!text || /^[-—]$/.test(text)) return null;
    const rank = ACTION_TYPE_ORDER.findIndex(type => game.i18n.localize(SR5.actionTypes[type as keyof typeof SR5.actionTypes]) === text);
    if (rank !== -1) return { number: rank, ranked: true };
    if (/^[A-Z]$/.test(text)) return { number: 0, ranked: false };
    // the language's separators, as the sheet prints numbers (toLocaleString(game.i18n.lang)): '0,75' and
    // '1 500' in Russian, '1.500' in German
    const decimal = decimalSeparator();
    const plain = decimal === ','
        ? text.replace(/(\d)[.\s](?=\d{3}\b)/g, '$1').replace(/(\d),(?=\d)/g, '$1.')
        : text.replace(/(\d)[,\s](?=\d{3}\b)/g, '$1');
    const number = /[-+]?\d+(?:\.\d+)?/.exec(plain.replace(/([-+]) (?=\d)/g, '$1'));
    return number ? { number: Number(number[0]), ranked: false } : { text };
}

/** The decimal separator of the game's language ('.' or ','). */
export function decimalSeparator(): string {
    return new Intl.NumberFormat(game.i18n.lang).formatToParts(1.5).find(part => part.type === 'decimal')?.value ?? '.';
}

/** Numbers before text, each in its own order; empty cells are left to the caller. */
export function compareSortValues(a: NonNullable<SortValue>, b: NonNullable<SortValue>): number {
    if ('number' in a && 'number' in b) return a.number - b.number;
    if ('number' in a) return -1;
    if ('number' in b) return 1;
    return a.text.localeCompare(b.text, game.i18n.lang);
}

export function cardRows(header: HTMLElement): HTMLElement[] {
    return [...header.parentElement!.querySelectorAll<HTMLElement>(':scope > .list-item-container')];
}

// The system's LinksHelpers plus the source icon and label the redesign added to the fork (src/module/utils/links.ts).
import { LinksHelpers as SystemLinksHelpers } from 'stock/module/utils/links';

export class LinksHelpers extends SystemLinksHelpers {
    /**
     * Font Awesome icon for a source by its kind, the same everywhere a source is shown: a rulebook page
     * ('SR5 132'), a web link, a Foundry document.
     */
    static sourceIcon(source: string | undefined): string {
        if (LinksHelpers.isPDF(source)) return 'fa-file-pdf';
        if (LinksHelpers.isURL(source)) return 'fa-link';
        if (LinksHelpers.isUuid(source)) return 'fa-file';
        return 'fa-question';
    }

    /** Short text for a source: a rulebook page as it is ('SR5 132'), a web link by its host, a document by its name. */
    static sourceLabel(source: string | undefined): string {
        if (!source) return '';
        if (LinksHelpers.isPDF(source)) return source;
        // an embedded document of a compendium (a compendium actor's item) cannot be looked up synchronously: the
        // uuid itself then
        if (LinksHelpers.isUuid(source)) {
            try { return (fromUuidSync(source) as { name?: string } | null)?.name ?? source; } catch { return source; }
        }
        if (LinksHelpers.isURL(source)) {
            try { return new URL(source, window.location.origin).hostname || source; } catch { return source; }
        }
        return source;
    }
}

// The fork's SheetFlow (the list helper the fork added, the source menu entry in a Font Awesome Free icon) with template
// paths pointing into the module for the sheet's own templates and for the system templates the module ships with the
// redesign's changes (list rows, item properties, the source icon, the karma / nuyen / reputation managers; see
// build.mjs).
import { SheetFlow as SystemSheetFlow } from 'fork/module/flows/SheetFlow';

const MODULE_TEMPLATES = 'modules/sr5-redesign/templates';
/** Apps whose templates the fork changed (buttons for the steps, labels for screen readers). */
const APPS = ['karma-manager', 'nuyen-manager', 'reputation-manager'];

export const SheetFlow = {
    ...SystemSheetFlow,
    templateBase(path: string) {
        if (path.startsWith('actor/redesign/')) return `${MODULE_TEMPLATES}/${path.slice('actor/redesign/'.length)}.hbs`;
        if (path.startsWith('list-items/') || path.startsWith('item-properties/')) return `${MODULE_TEMPLATES}/system/${path}.hbs`;
        if (path === 'common/document-source-icon') return `${MODULE_TEMPLATES}/system/${path}.hbs`;
        if (APPS.some(app => path.startsWith(`actor/apps/${app}/`))) return `${MODULE_TEMPLATES}/system/${path}.hbs`;
        return SystemSheetFlow.templateBase(path);
    },
} as typeof SystemSheetFlow;

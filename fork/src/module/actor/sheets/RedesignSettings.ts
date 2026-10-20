/** A group of the SR5 Redesign settings, by what its features are for. */
interface SettingsCategory {
    id: string;
    label: string;
}

/** One setting of the SR5 Redesign, shown in its category. */
interface RedesignSetting {
    key: string;
    category: string;
    /** world: the GM sets it for everyone; user: each player for themselves, remembered on any device */
    scope: 'world' | 'user';
    type: typeof Boolean;
    default: boolean;
    name: string;
    /** one line under the field, as Foundry's settings */
    hint: string;
    /** the longer explanation on the name's tooltip */
    tooltip: string;
    /** what a change does; without one the open redesigned sheets are drawn again */
    onChange?: (value: unknown) => void;
}

/** The categories in the order they are listed; a category without settings stays out. */
const CATEGORIES: SettingsCategory[] = [
    { id: 'sidebar', label: 'SR5.Redesign.Settings.Category.Sidebar' },
    { id: 'details', label: 'SR5.Redesign.Settings.Category.Details' },
    { id: 'accessibility', label: 'SR5.Redesign.Settings.Category.Accessibility' },
];

/** Readable text: a body class the stylesheet keys on (actor-redesign.scss, the end), no render needed. */
const applyReadableText = (value: unknown) => document.body.classList.toggle('sr5-redesign-readable', !!value);

const SETTINGS: RedesignSetting[] = [
    {
        key: 'showActions',
        category: 'sidebar',
        scope: 'world',
        type: Boolean,
        default: false,
        name: 'SR5.Redesign.Settings.ShowActions.Name',
        hint: 'SR5.Redesign.Settings.ShowActions.Hint',
        tooltip: 'SR5.Redesign.Settings.ShowActions.Tooltip',
    },
    {
        key: 'showQualities',
        category: 'details',
        scope: 'user',
        type: Boolean,
        default: true,
        name: 'SR5.Redesign.Settings.ShowQualities.Name',
        hint: 'SR5.Redesign.Settings.ShowQualities.Hint',
        tooltip: 'SR5.Redesign.Settings.ShowQualities.Tooltip',
    },
    {
        key: 'readableText',
        category: 'accessibility',
        scope: 'user',
        type: Boolean,
        default: false,
        name: 'SR5.Redesign.Settings.ReadableText.Name',
        hint: 'SR5.Redesign.Settings.ReadableText.Hint',
        tooltip: 'SR5.Redesign.Settings.ReadableText.Tooltip',
        onChange: applyReadableText,
    },
];

/**
 * The SR5 Redesign's own settings (world ones for everyone, user ones per player), in an entry of their own in Configure Settings ("Shadowrun 5th Edition
 * Redesign", right under the system), shown there like any setting: no window of their own. One namespace in the fork and the
 * module (the module's id; in the fork no package has it, so Foundry would file them under "Unmapped": the
 * category browser is taught the entry). Categories show as fieldsets inside the entry. Registered at init by the
 * system (hooks.ts) or the module (its entry). A change redraws the open redesigned sheets.
 */
export const RedesignSettings = {
    namespace: 'sr5-redesign',

    register() {
        const settings = game.settings as unknown as { register(namespace: string, key: string, config: object): void };
        for (const setting of SETTINGS) {
            settings.register(RedesignSettings.namespace, setting.key, {
                name: setting.name,
                hint: setting.hint,
                scope: setting.scope,
                config: true,
                type: setting.type,
                default: setting.default,
                onChange: setting.onChange ?? (() => RedesignSettings.redrawSheets()),
            });
        }
        // user settings are read once the user is known
        Hooks.once('ready', () => applyReadableText(RedesignSettings.get('readableText')));
        RedesignSettings.teachSettingsConfig();
    },

    get(key: string): unknown {
        return (game.settings as unknown as { get(namespace: string, key: string): unknown }).get(RedesignSettings.namespace, key);
    },

    /** The open redesigned sheets, drawn again with the new settings. */
    redrawSheets() {
        for (const app of foundry.applications.instances.values()) {
            if (app.rendered && app.element?.classList.contains('sr5-redesign')) void app.render();
        }
    },

    /**
     * Configure Settings: the namespace becomes its own entry named after the system, listed right after it;
     * once rendered, its settings are grouped into a fieldset per category and their names carry the tooltip.
     */
    teachSettingsConfig() {
        // the two methods Foundry sorts the setting categories with (protected, so not in the types)
        type Category = { id: string, label?: string };
        type Patched = {
            _categorizeEntry(this: unknown, entry: string): Category;
            _sortCategories(this: unknown, a: Category, b: Category): number;
        };
        const SettingsConfig = foundry.applications.settings.SettingsConfig as unknown as { prototype: Patched };
        const namespace = RedesignSettings.namespace;
        const categorize = SettingsConfig.prototype._categorizeEntry;
        SettingsConfig.prototype._categorizeEntry = function (entry: string) {
            // named after the system ("Shadowrun 5th Edition Redesign"), so it reads as part of it
            if (entry === namespace) return { id: namespace, label: game.i18n.format('SR5.Redesign.Settings.Title', { system: game.system.title }) };
            return categorize.call(this, entry);
        };
        const sort = SettingsConfig.prototype._sortCategories;
        SettingsConfig.prototype._sortCategories = function (a: Category, b: Category) {
            // right after the system (0 core, 1 system, 2 modules in Foundry's order)
            const rank = (category: Category) => category.id === namespace ? 1.5 : category.id === 'core' ? 0 : category.id === 'system' ? 1 : 2;
            return (rank(a) - rank(b)) || sort.call(this, a, b);
        };
        Hooks.on('renderSettingsConfig', (app: { element: HTMLElement }) => {
            const section = app.element.querySelector<HTMLElement>(`section[data-category="${namespace}"]`);
            if (!section || section.querySelector('fieldset')) return;
            for (const category of CATEGORIES) {
                const groups = SETTINGS.filter(setting => setting.category === category.id).flatMap(setting => {
                    const input = section.querySelector(`[name="${namespace}.${setting.key}"]`);
                    const group = input?.closest<HTMLElement>('.form-group');
                    const label = group?.querySelector<HTMLElement>('label');
                    if (label) label.dataset.tooltip = game.i18n.localize(setting.tooltip);
                    return group ? [group] : [];
                });
                if (!groups.length) continue;
                const fieldset = document.createElement('fieldset');
                const legend = document.createElement('legend');
                legend.textContent = game.i18n.localize(category.label);
                fieldset.append(legend);
                groups[0].before(fieldset);
                fieldset.append(...groups);
            }
        });
    },
};

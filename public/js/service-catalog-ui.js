/**
 * UI de catálogo de servicios: chips seleccionables por categoría.
 */
window.DeseoServiceCatalog = (function () {
    const API_URL = typeof window !== 'undefined' && window.API_URL ? window.API_URL : '';

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    function renderChipsHtml(catalog, selectedIds) {
        const selected = new Set((selectedIds || []).map((id) => String(id)));
        if (!catalog || !catalog.groups || !catalog.groups.length) {
            return '<p class="service-catalog-empty">No hay catálogo disponible para esta categoría.</p>';
        }

        return catalog.groups.map((group) => {
            const minHint = group.minSelect
                ? `<span class="service-group-min">Mínimo ${group.minSelect}</span>`
                : '';
            const chips = group.items.map((item) => {
                const isSelected = selected.has(item.id);
                return `<button type="button" class="service-chip${isSelected ? ' selected' : ''}" data-service-id="${escapeHtml(item.id)}" data-group-id="${escapeHtml(group.id)}" aria-pressed="${isSelected ? 'true' : 'false'}">${escapeHtml(item.label)}</button>`;
            }).join('');
            return `
                <div class="service-group" data-group-id="${escapeHtml(group.id)}" data-min-select="${group.minSelect || 0}">
                    <div class="service-group-header">
                        <h4>${escapeHtml(group.title)}</h4>
                        ${minHint}
                    </div>
                    <div class="service-chip-list">${chips}</div>
                </div>`;
        }).join('');
    }

    function bindChipToggle(container) {
        if (!container) {
            return;
        }
        container.querySelectorAll('.service-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const selected = chip.classList.toggle('selected');
                chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
            });
        });
    }

    function readSelection(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            return [];
        }
        return [...container.querySelectorAll('.service-chip.selected')]
            .map((chip) => chip.getAttribute('data-service-id'))
            .filter(Boolean);
    }

    function renderServiceChipsHtml(labels, maxItems) {
        const list = (labels || []).slice(0, maxItems || labels.length);
        if (!list.length) {
            return '';
        }
        return list.map((item) => {
            const label = typeof item === 'string' ? item : item.label;
            return `<span class="service-chip-display">${escapeHtml(label)}</span>`;
        }).join('');
    }

    async function fetchCatalog(category) {
        const params = new URLSearchParams({ category: category || 'acompañantes-mujeres' });
        const response = await fetch(`${API_URL}/api/services/catalog?${params}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'No se pudo cargar el catálogo de servicios');
        }
        return data.catalog;
    }

    async function mountEditor(options) {
        const containerId = options.containerId;
        const category = options.category || 'acompañantes-mujeres';
        const selectedIds = options.selectedIds || [];
        const container = document.getElementById(containerId);
        if (!container) {
            return null;
        }

        container.innerHTML = '<p class="service-catalog-loading">Cargando servicios...</p>';
        try {
            const catalog = await fetchCatalog(category);
            container.innerHTML = renderChipsHtml(catalog, selectedIds);
            bindChipToggle(container);
            return catalog;
        } catch (error) {
            container.innerHTML = `<p class="service-catalog-error">${escapeHtml(error.message)}</p>`;
            return null;
        }
    }

    return {
        fetchCatalog,
        mountEditor,
        readSelection,
        renderServiceChipsHtml,
        renderChipsHtml
    };
})();

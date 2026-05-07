## Objetivo
Definir una hoja de ruta para adaptar la experiencia web de Deseo Libre a pantallas móviles mediante un diseño responsivo consistente y mantenible.

## Estado actual (auditoría rápida)
- `index.html`, `home.html`, `feed*.html`, `profile.html` cuentan con `<meta name="viewport">`, pero concentran casi todo el CSS inline en cada archivo.
- Se repiten variables y estilos con ligeras variaciones; no existe un archivo base compartido ni un sistema claro de breakpoints.
- La navegación principal usa `flex` pero no dispone de menú colapsable/hamburguesa ni jerarquía móvil; botones y paddings son grandes para pantallas pequeñas.
- Las rejillas (`grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`) funcionan en desktop, pero no se ajustan debajo de ~360 px y mantienen paddings de 24–32 px que provocan scroll horizontal.
- Componentes críticos (tarjetas de categorías, cards del feed, formularios, carruseles) no reducen tipografías ni elementos multimedia en viewports chicos; no se gestionan alturas máximas para videos/imágenes ni contenedores desplazables.
- `public/css/components.css` contiene styles reutilizables, pero no se referencia desde la mayoría de páginas HTML, por lo que el código continua duplicado.

## Principios guía
- Mobile-first: definir estilos base para ≤480 px y escalar con `min-width`.
- Tokens y tipografías fluidas mediante `clamp()` para mantener jerarquía sin saltos.
- Layouts flexibles con `flex`/`grid`, restricciones de ancho, columnas colapsables y contenedores scrollables.
- Reutilización: mover colores, sombras y componentes a `public/css/` y usar clases consistentes.
- Accesibilidad: contraste mínimo AA, objetivos táctiles ≥44 px, navegación por teclado.

## Fases propuestas

### Fase 0 · Preparación (1 día)
- Crear `public/css/base.css` con reset moderno, tokens de color/tipografía, breakpoints (`--bp-sm: 480px`, `--bp-md: 768px`, `--bp-lg: 1024px`).
- Consolidar componentes globales en `components.css` y enlazarlos desde todas las páginas.
- Configurar estructura de carpetas (`public/css/base.css`, `layout.css`, `components.css`, `pages/*.css`) y actualizar referencias `<link>`.

### Fase 1 · Header y navegación (1-2 días)
- Implementar header responsive con logo, acciones y botón hamburguesa (`<button aria-controls>`).
- Añadir panel off-canvas o dropdown para menús en ≤768 px.
- Ajustar espaciados/paddings con `clamp()` y limitar alturas de hero.

### Fase 2 · Secciones principales (2-3 días)
- `index.html`: refactor de cards de servicios/comunidades/testimonios con grid responsivo y ajustes de tipografías.
- `home.html` y `feed*.html`: adaptar cards de categoría (apilar contenido, iconos reducidos, texto envolvente), asegurar `gap` y paddings fluidos.
- `reels.html` y páginas multimedia: definir contenedores que preserven ratios (`aspect-ratio`), optimizar videos/imágenes y controles táctiles.

### Fase 3 · Páginas interiores y formularios (2 días)
- `profile.html` + backups: reorganizar columnas secundarias en stack mobile, optimizar tabs y formularios (inputs al 100%, botones bloque).
- Revisar `admin`/`verificar` HTML para consistencia, aplicar clases globales.
- Asegurar consistencia en botones (primario, secundario, ghost) y mensajes de estado; centralizar estilos de `post-card`.

### Fase 4 · QA y performance (1-2 días)
- Pruebas manuales en Chrome DevTools (375 px, 414 px, 768 px, 1024 px) y al menos un dispositivo real Android/iOS.
- Validar contraste con Lighthouse, revisar CLS, ajustar tiempos de carga (optimizar fuentes/pesos, lazy load multimedia).
- Documentar patrones en `GUIA-USO.md` o nuevo `docs/ui-guidelines.md`.

## Entregables clave
- CSS modular enlazado (sin estilos inline en HTML).
- Componentes reutilizables (`dl-button`, `dl-card`, `dl-header`) documentados.
- Checklist de breakpoints probados y capturas antes/después.
- Guía breve de estándares responsive para futuras páginas.

## Próximos pasos inmediatos
1. Confirmar si podemos mover los estilos inline a archivos externos sin romper dependencias actuales.
2. Priorizar páginas MVP (ej. `index.html`, `home.html`, `profile.html`) para liberar versión móvil rápidamente.
3. Planificar sesiones de revisión visual con stakeholders tras cada fase.



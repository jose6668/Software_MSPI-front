# HU-SEG-002 — Prevención de secretos en frontend

Estado: implementación local; verificación/publicación en curso.
Rama: `feat/HU-SEG-002-prevencion-secretos`.
Base Develop: `86a30f10f671d0c04b982d8c7d1958e19892dfc6`.
PR: pendiente de publicación.

Como equipo, queremos impedir que configuración privada o secretos lleguen al repositorio y al futuro bundle del navegador.

Implementación: .gitignore raíz, plantilla con ruta pública /api, verificador de archivos/plantillas y workflow Secret hygiene con Gitleaks 8.30.1 fijado por versión/SHA-256. [Guía](../../SECRETOS-Y-CONFIGURACION.md).

Trazabilidad: H-01, SEC-001/002, P01/P02 y ASVS 5.0.0 V13.3.1. VITE_* se considera público; solo se permite la variable de ruta aprobada hasta definir otras mediante cambios explícitos.

Aceptación: exclusiones locales/anidadas y plantilla versionable; rechazo de .env forzado al índice; valores privados y URLs con credenciales rechazados; comprobante sintético detectado en archivos e historial y redactado; escaneos actuales sin hallazgos no revisados; CI satisfactoria y PR hacia Develop.

No se inicializa React ni se cambian contratos backend o datos de negocio. No hay pruebas de aplicación frontend que declarar ejecutadas todavía. Resultados locales y CI se registran al completar la verificación.

Verificación local del 8 de noviembre de 2026: verificador y pruebas negativas satisfactorios con Python 3.13 y Gitleaks 8.30.1; archivos e historial disponibles sin hallazgos, salidas 0. Se comprobó rechazo de archivo forzado, plantilla privada/URL con credencial, detección actual e histórica de comprobante sintético y redacción. `git diff --cached --check` pasó. CI pendiente de publicación.

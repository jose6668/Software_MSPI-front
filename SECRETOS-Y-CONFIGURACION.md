# Configuración pública y secretos

HU-SEG-002 añade exclusiones y una comprobación real en CI antes de inicializar la aplicación frontend. No añade aún pantallas, dependencias o un servidor.

`.env.example` contiene solo `VITE_API_BASE_URL=/api`, una ruta pública para la futura configuración. Todo valor VITE_* incorporado al frontend puede ser leído por el usuario del navegador: nunca poner ahí contraseñas, tokens, claves privadas o credenciales de base/SMTP. Las nuevas variables públicas deben incorporarse explícitamente a la política del verificador al definirlas.

El .gitignore raíz excluye configuración local, archivos de claves, volcados, directorios de secretos y salidas de construcción. No protege valores ya versionados ni sustituye los permisos del equipo.

El workflow `Secret hygiene` corre en PR hacia Develop y pushes a esa rama: comprueba archivos versionados/plantillas, prueba el detector con un comprobante sintético en un repositorio temporal y examina historial y archivos con Gitleaks 8.30.1, versión y SHA-256 fijados. Se usa redacción del 100 %, checkout sin credenciales persistidas y permisos de lectura. No se entrega ningún secreto a ese workflow.

Desde la raíz, con Python 3 y el detector verificado:

```powershell
python .github/scripts/check_secret_hygiene.py --self-test --gitleaks 'C:\ruta\gitleaks.exe'
gitleaks git . --log-opts='--all --full-history' --redact=100 --ignore-gitleaks-allow
gitleaks dir . --redact=100 --ignore-gitleaks-allow
```

Forzar un archivo privado con git add -f no supera el verificador. No crear excepciones .gitleaksignore/.gitleaks.toml para ocultar hallazgos. Un cambio legítimo de política debe ser explícito y revisado.

El check falla ante un hallazgo; para prohibir la fusión administrativamente debe configurarse como obligatorio en la protección de Develop, que esta entrega no modifica. La detección por patrones es una ayuda y no garantiza detectar todos los secretos.

Si una clave se publica, revocarla o rotarla primero, actualizar la configuración privada, retirarla del código/artefactos/logs y evaluar el historial sin copiar el valor a incidencias. Coordinar cualquier reescritura de ramas con los colaboradores. No usar una clave real para probar el detector.

# Software_MSPI-front

Prevención de secretos implementada en PR hacia Develop: [configuración y verificación](SECRETOS-Y-CONFIGURACION.md), [HU-SEG-002](docs/hu/HU-SEG-002.md).

## Iniciar el frontend local

HU-FRONT-001 permite iniciar sesión, listar y elegir una empresa autorizada, consultar su contexto y cerrar sesión. Desde la empresa, **Ver evaluaciones** abre el listado, el detalle y sus respuestas ([HU-FRONT-002](docs/hu/HU-FRONT-002.md)). Necesita el backend MSPI en ejecución en Docker, con HTTPS y una cuenta de prueba con membresía. El navegador usa el mismo origen para la interfaz y la API.

El espacio autenticado usa la navegación de Panorama. En el detalle de una evaluación, abre **Evidencias** en una respuesta para consultar y descargar sus adjuntos autorizados ([HU-FRONT-003](docs/hu/HU-FRONT-003.md)).

El **Resumen de empresa** muestra los resultados de la evaluación más reciente disponible. El detalle también presenta sus resultados por dominio y por cláusula ([HU-FRONT-004](docs/hu/HU-FRONT-004.md)).

Desde PowerShell, indicar el nombre del proyecto Compose del backend y el directorio TLS privado que contiene `server.p12`, `server-password.txt` y `ca.crt`:

```powershell
./scripts/Start-MspiFrontend.ps1 -BackendProject mspi-evaluacion -TlsDirectory C:/RutaPrivada/MSPI/https
```

Abrir [MSPI en localhost](https://localhost:6443). El equipo debe confiar en la CA pública del laboratorio y el certificado debe incluir `localhost`. El script une el frontend y el backend en una red interna y publica solo el puerto HTTPS de la interfaz en loopback. Si Docker recrea el backend, repetir el comando para adjuntarlo de nuevo. Para usar otro puerto local añadir `-Port 6444`.

Para verificar las rutas, el reenvío seguro y los rechazos del servidor, ejecutar `node --test` con Node 22 y OpenSSL disponibles. En Windows se puede indicar la ruta de OpenSSL con `OPENSSL_BIN`. GitHub ejecuta esas pruebas y construye la imagen en los PR a `Develop`. [Alcance y validación](docs/hu/HU-FRONT-001.md)

# HU-FRONT-001. Inicio de sesión y selección de empresa

Como integrante de una empresa, quiero iniciar sesión, consultar las empresas a las que pertenezco y seleccionar una para entrar a su contexto. Puedo cerrar la sesión desde la lista o el contexto.

- El navegador usa las rutas de identidad y membresías del backend. Pide un token CSRF para cada modificación y mantiene la cookie del servidor. La interfaz no guarda credenciales o tokens en almacenamiento web.
- La página de empresa consulta el contexto vigente al navegar y al recargar. La autorización del UUID se realiza en el backend.
- La interfaz contempla credenciales inválidas, sesión ausente o vencida, empresa ajena, paginación y fallos de conexión. La vista de empresa presenta el nombre, los roles y la zona horaria.
- El servidor de frontend acepta las rutas de esta historia, publica HTTPS en loopback y verifica la CA y el nombre del certificado del backend. Solo monta material TLS de servidor y la CA pública.

Validación local en Chrome con backend, PostgreSQL y ClamAV en Docker. Se comprobó el rechazo de credenciales inválidas, la cookie Secure y HttpOnly, el acceso a una empresa, la recarga, el 403 al cambiar el UUID por el de otra empresa y el 401 después de cerrar sesión. También se revisó la vista móvil. CI prueba la lista de rutas, el reenvío de cookie y CSRF, el rechazo de origen y cuerpo inválidos y la verificación TLS del backend.

Los listados de evaluaciones y la gestión de evidencias corresponden a las siguientes historias.

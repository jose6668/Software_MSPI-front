# HU-FRONT-003 · Navegación Panorama y consulta de evidencias

Como integrante autorizado, quiero identificar la empresa activa, navegar a sus evaluaciones y descargar las evidencias disponibles de una respuesta.

## Alcance

- El espacio autenticado toma la distribución del boceto Panorama y los colores del inicio de sesión. En escritorio usa navegación lateral. En móvil reúne las secciones disponibles en un selector. La cabecera muestra la empresa activa, los roles y el acceso a **Cambiar empresa**.
- El menú conecta **Resumen de empresa** y **Evaluaciones** según los permisos de lectura de la empresa activa. Los módulos del boceto se incorporan a medida que existan flujos conectados.
- **Evidencias** consulta los adjuntos de una respuesta al desplegarla. Muestra el nombre, tamaño y descripción disponible. La consulta es paginada y el nombre abre la descarga. Esta historia se limita a lectura.

## Seguridad y verificación

- El gateway acepta únicamente `GET` para el listado paginado de evidencias y para el archivo identificado. El backend de HU-025 autoriza sesión, empresa, evaluación, respuesta y adjunto.
- Las descargas exitosas se sirven como adjuntos PDF, PNG o JPEG, con aislamiento de contenido y sin caché. Las pruebas del gateway verifican el rechazo de métodos de escritura, contenido inesperado y respuesta en línea.
- Para probarlo en Docker y Chrome por HTTPS, entrar a una empresa con una evaluación que tenga evidencia disponible. Abrir el detalle desde el menú, desplegar **Evidencias** y seleccionar el archivo. Comprobar el menú móvil y el retorno a **Mis empresas**.
- Repetir la consulta con un identificador de empresa ajena, respuesta incorrecta o evidencia bloqueada y luego sin sesión. El servidor debe rechazar esos accesos.

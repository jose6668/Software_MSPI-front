# HU-FRONT-002 · Consultar evaluaciones

Como integrante autorizado de una empresa, quiero consultar sus evaluaciones y las respuestas de cada una para conocer su estado y alcance.

## Flujo

1. Iniciar sesión y elegir una empresa en **Mis empresas**.
2. Seleccionar **Ver evaluaciones**. Cada fila muestra el nombre, la fecha y el estado.
3. Abrir una evaluación. El detalle muestra su alcance y las respuestas del catálogo con aplicabilidad, calificación, justificación y fundamento cuando están disponibles. El listado y las respuestas se consultan en páginas de 20.

El gateway admite únicamente `GET` para el listado, el detalle y las respuestas, con UUID válidos y parámetros acotados. El backend autoriza cada solicitud según la sesión, la empresa y la evaluación. La interfaz renderiza los campos como texto y muestra un aviso cuando no puede acceder. La vista es de solo lectura.

## Verificación local

- Con el frontend y el backend en Docker, abrir el detalle en Chrome por HTTPS y recargarlo. Debe conservar el detalle correcto y mostrar sus respuestas. Comprobar también el ancho móvil.
- Sustituir en la URL el UUID de la empresa por el de una empresa sin membresía. El listado, el detalle y las respuestas deben devolver `403` al consultarlos por API. En pantalla se muestra un aviso sin datos de evaluación.
- Usar un UUID inexistente en la empresa autorizada. El detalle devuelve `404`. Tras cerrar sesión, el detalle y las respuestas devuelven `401`.
- Ejecutar `node --test` para comprobar la lista de rutas del gateway, el rechazo de escrituras y la validación de la paginación.

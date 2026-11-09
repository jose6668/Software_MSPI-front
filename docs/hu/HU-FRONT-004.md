# HU-FRONT-004 · Resultados en Panorama

Como integrante con permiso de consulta, quiero ver el resultado de la evaluación más reciente en la empresa activa y consultar sus resultados en el detalle.

- El resumen abre la primera evaluación devuelta por la lista del backend, ordenada por fecha de evaluación descendente. El enlace lleva al detalle de esa evaluación.
- El puntaje de controles evaluados, el avance, las respuestas sin calificar, la aplicabilidad pendiente y las exclusiones se muestran por separado. Un resultado ausente se distingue de una nota cero.
- El resumen y el detalle consultan el mismo cálculo del backend. Se muestran los resultados por dominio y, en una sección aparte, por cláusula.
- El gateway permite únicamente la lectura de `/api/v1/empresas/{empresaId}/evaluaciones/{evaluacionId}/resultados`. El backend valida la sesión, la membresía y la evaluación.

## Comprobación

Con los datos de demostración Panorama en Docker, abrir Andina y comprobar 64,00 puntos provisionales, 70,59 % de avance y 60 de 85 controles. Consultar la tabla por dominio, desplegar las cláusulas y abrir la evaluación. Cambiar a Litoral y comprobar que se muestra el estado vacío. En Chrome por HTTPS, probar también el selector de navegación móvil y el rechazo al alterar la empresa de una evaluación o cerrar la sesión.

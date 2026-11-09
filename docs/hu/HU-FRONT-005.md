# HU-FRONT-005 · Consulta de activos

Como integrante autorizado, quiero consultar el inventario de la empresa activa y abrir la ficha de cada activo para conocer su proceso, propietario y clasificación.

- En **Activos**, la búsqueda por nombre o código y los filtros de tipo y estado se aplican en el servidor. La lista muestra páginas de 20 registros y distingue si cada activo tiene una clasificación confirmada.
- La ficha muestra el proceso, el propietario, el custodio cuando existe, y los valores de confidencialidad, integridad y disponibilidad. Si coexisten una clasificación vigente y otra pendiente, se muestran por separado. Un valor faltante aparece como **Pendiente**.
- La interfaz ofrece la consulta a AE, GS y AU dentro de la empresa activa. El backend valida la sesión, la membresía y la pertenencia de los registros. El gateway solo permite las lecturas usadas por la vista y acota los parámetros de búsqueda.

## Verificación

En Docker y Chrome por HTTPS, abrir **Activos** en Andina y recorrer las tres páginas de la muestra de 48 registros. Buscar `nómina` con tipo **Software** y estado **Activo**. Abrir `ACT-033` para ver la clasificación vigente y `ACT-040` para comprobar que su integridad figura como pendiente.

Cambiar a Litoral y comprobar el inventario vacío. Copiar un identificador de activo de Andina a una URL de Litoral y verificar que se rechace la consulta. Probar también el acceso con un rol RA sin permisos de lectura de inventario y sin sesión.

# Paginación de listados

Los listados usan `page` (desde 1) y `pageSize` (1–100; por defecto 20).
La respuesta contiene `data`, `total`, `page`, `pageSize` y `totalPages`.
Llamadas conserva la propiedad `items` para sus registros y expone los mismos metadatos.
Los usuarios de empresa conservan además `activos` y `limite`, calculados sobre toda la empresa.

| Listado | Backend | Frontend |
| --- | --- | --- |
| Leads, inmuebles, usuarios de plataforma y organizaciones | Paginación existente en base de datos | `Pagination` existente |
| Páginas y cuentas de Meta vinculadas, notificaciones | Paginación existente | `Pagination` existente |
| Usuarios de empresa | Filtros, conteo y `skip/take` | Filtros globales y `Pagination` |
| Conversaciones | Búsqueda, visibilidad, conteo y `skip/take` | `Pagination` compacto; búsqueda incluye borradores locales |
| Kanban | Búsqueda, conteo y `skip/take`; eliminado el recorte de 300 | Página de hasta 100 leads agrupados por etapa y `Pagination` |
| Llamadas e historial de llamadas del lead | `skip/take` y metadatos; validación de parámetros | `Pagination`; eliminado el recorte local de 8 |
| Visitas del lead e historial del pipeline | Conteo y `skip/take` después del control de acceso | `Pagination` |
| Historial del bot y del control de chat | Conteo y `skip/take`; eliminado el recorte de 100 | `Pagination` en los historiales |
| Formularios de una página | Colección calculada con conteos y paginación | Consulta por página y `Pagination` |
| Interesados de un inmueble | Ranking y visibilidad completos antes de paginar | Consulta por página, puestos globales y `Pagination` |
| Catálogo de módulos, grupos y matriz de permisos | Paginación de colección | `Pagination` por grupo y por sus módulos |
| Números de WhatsApp vinculados y recursos disponibles para vincular | Paginación de colección | `Pagination` |
| Gestión de plantillas de WhatsApp | Paginación de colección de Meta | Consulta por página y `Pagination` |
| Destinos de reenvío | Conversaciones obtenidas recorriendo páginas | Filtrado y paginación local con `Pagination` |
| Mensajes del chat | Cursor estable; 200 iniciales y lotes anteriores de 50 | Cargar anteriores conservando historial y posición al refrescar |

`PaginarColeccion` valida los parámetros y pagina catálogos finitos o resultados que deben
calcularse completos (ranking, conteos de formularios, recursos de Meta). Estos casos no
usan `skip/take` en su origen: la colección se calcula antes de cortar la página.
Las tablas de mayor volumen paginan en el repositorio.

Los editores de dependencias y selectores que necesitan el catálogo completo recorren
explícitamente todas sus páginas con `apiFetchCollection`; no se limitan a la primera.
Las opciones de filtros, las series agregadas del dashboard y el calendario por rango
conservan sus contratos completos para no alterar los cálculos ni ocultar eventos.

Backend y frontend deben desplegarse juntos: varios endpoints que devolvían arrays
ahora devuelven un objeto paginado. No se requiere migración de base de datos.

Se verifican parámetros inválidos, página vacía y última página, acceso después de los
recortes de 100/300, filtros y organización compartidos por conteo y consulta, cupos
globales de usuarios y carga anterior de mensajes por cursor.

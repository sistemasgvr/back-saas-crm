# Logo por empresa

Se reutiliza `ObjectStorage` y el único bucket configurado por `MINIO_BUCKET`.
Cada imagen se almacena con una clave independiente:

`organizations/{organizacionId}/branding/{uuid}.webp`

Estos son prefijos dentro del mismo bucket, no buckets por empresa. El ID siempre
se obtiene de la sesión autenticada; el nombre del archivo y los campos del
navegador no pueden elegir claves ni organizaciones.

Se reutiliza la columna `organizaciones.logo_url` para la referencia al objeto.
No se necesita migración de esquema. La respuesta de configuración y `/me`
transforma la clave en una ruta privada de frontend con versión. No expone el
endpoint ni credenciales de MinIO. Las URLs HTTP(S) heredadas siguen siendo legibles.

- `POST /organizations/current/logo`: propietarios y administradores; multipart
  con campo `archivo`, PNG/JPG/WebP hasta 2 MB.
- `DELETE /organizations/current/logo`: mismos roles; limpia la referencia y
  restaura el logo local del sistema.
- `GET /organizations/current/logo?v=...`: cualquier miembro activo; verifica
  empresa y versión antes de leer el objeto. Respuesta privada sin caché compartida.

El frontend usa `/api/organizations/logo` como proxy autenticado. Las mutaciones
comprueban el origen y la subida limita el cuerpo antes de parsear multipart.
El control de roles y pertenencia se revalida en backend.

Sharp decodifica y valida el contenido real, rechaza imágenes animadas y entradas
de más de 16 megapíxeles, conserva transparencia, ajusta el tamaño a un máximo de
1024×1024 sin recortar y guarda WebP. No se admiten SVG ni archivos meramente
renombrados. Se eliminan las versiones sustituidas de la misma empresa después
de actualizar su referencia. Si falla la persistencia, se limpia el archivo nuevo;
si falla la subida, el logo anterior no se altera.

La UI reutiliza `FileInput` de la plantilla, muestra vista previa y mantiene el
guardado del logo separado de los demás campos de empresa. Sidebar expandido,
contraído y cabecera móvil reciben el logo de la empresa activa; la ausencia o un
error de carga usa el logo local. Inicio de sesión y administración de plataforma
conservan la identidad del sistema.

Validaciones: `npx jest --runInBand logo-organizacion.service.spec` en backend y
`npm run test:logos` en frontend. Las pruebas usan almacenamiento simulado y no
suben imágenes a MinIO ni modifican la base de datos real. Desplegar ambos proyectos
e instalar las dependencias del backend para disponer de Sharp.

# Gestión de usuarios por empresa — entrega de código

## Alcance implementado

- Configuración → Usuarios para propietarios y administradores: alta, edición, desactivación, reactivación y contraseña temporal.
- Cada cuenta de cliente queda limitada a una empresa. Un correo ocupado no se puede vincular a otra empresa, tampoco desde plataforma. Los datos históricos no se reasignan automáticamente.
- Solo plataforma crea o gestiona cuentas propietarias. Se mantiene el perfil personal existente.
- Cupo de usuarios activos configurado por plataforma, incluido el propietario; vacío significa ilimitado. Bajar el cupo no desactiva cuentas existentes.
- Corrección Fase 3b: solo cuentan membresías activas de cuentas globalmente activas de cliente. Las cuentas de plataforma y las suspendidas no consumen cupo. Empresa y plataforma utilizan el mismo criterio para el contador.
- Altas y reactivaciones con bloqueo transaccional por empresa. La asignación de una cuenta existente también se bloquea por usuario para impedir vinculación simultánea a dos empresas.
- Contraseña temporal para altas del equipo y restablecimientos: login y `/me` exponen el estado; la API bloquea otras operaciones hasta cambiarla. La interfaz fuerza la pantalla de cambio.
- Desactivación: pierde acceso a la empresa, sale de la rotación, libera chats a MANUAL mediante ControlAtencionService con auditoría y revoca refresh cuando no quedan membresías activas. Los intentos ya despachados se conservan para reconciliación.
- Los leads permanecen asignados y se muestra su cantidad. La pantalla permite reasignarlos en bloque a otro miembro activo de la misma empresa.
- Historial de membresías inmutable. Nunca se incluyen contraseñas en los eventos ni respuestas de listado.

## Migración

`20261021200000_gestion_usuarios_empresa` agrega `organizaciones.limite_usuarios`, `usuarios.debe_cambiar_password` y `organizacion_usuario_eventos`, con restricciones e inmutabilidad.

No modifica valores existentes. Los usuarios anteriores conservan su contraseña y las empresas quedan sin límite. Las altas antiguas de plataforma conservan su comportamiento de contraseña; la obligatoriedad se aplica a las cuentas nuevas creadas por la empresa y a los restablecimientos temporales.

## Verificación realizada antes del cambio de alcance

| Comprobación | Último resultado registrado |
| --- | --- |
| TypeScript backend y frontend | Correctos |
| Unitarias | 200 aprobadas |
| Integración PostgreSQL | 28 aprobadas; incluye dos altas concurrentes con una plaza, auditoría inmutable, liberación de chats y efectos de baja |
| API previa | 58 aprobadas |
| Gestión de usuarios por API | 9 escenarios aprobados |
| Envíos con Meta simulado | 19 aprobados |
| Pantallas | Propietario crea/desactiva/reactiva; administrador edita en móvil; asesor redirigido a perfil; plataforma guarda cupo; límite lleno/superado; cambio obligatorio y reasignación de leads |

Las evidencias están en `outputs/qa-usuarios/` en la raíz del workspace. Los scripts y fixtures sintéticos privados están en `.tmp/postgres-docker/`.

El ensayo previo de la migración conservó conteos y hashes de las columnas originales de las 33 tablas del respaldo local: 9 usuarios, 9 membresías, 1054 leads, 939 conversaciones y 10567 mensajes. El esquema no presentó diferencias después del ensayo.

## Estado al entregar

### Correcciones Fase 3b

Se aplicaron los 15 puntos de la revisión del plan. La gestión del equipo utiliza Select/SelectSearch, TableAction con iconos, TableCard/Table en escritorio, tarjetas en móvil, EntityCell, Badge/StatusBadge, DynamicFilters y EmptyState. Los modales usan ModalHeading; el restablecimiento incluye Cancelar y el error de estado aparece en la confirmación. Configuración reutiliza CollapsibleSection para acceder a Usuarios; la plataforma muestra el uso con Badge rojo si se supera el límite. La pantalla de cambio obligatorio incorpora los iconos solicitados.

La reasignación conserva la transacción de cambios y la auditoría de membresía y utiliza CrearNotificacionUseCase después del commit para avisar al destinatario con una notificación resumida. No notifica si no se movieron leads. El historial existente registra transiciones de estado, no asignaciones individuales; no se agregaron transiciones ficticias por reasignación.

Se actualizaron los dobles de la nueva dependencia de notificaciones y el escenario de integración que cubre cuentas de plataforma y suspendidas. Estas correcciones no se probaron ni se compilaron y no se modificaron datos, respetando la instrucción de que el usuario realizará las pruebas. Las cifras anteriores corresponden al código previo a la Fase 3b.

El usuario indicó expresamente continuar solo con código y que realizará las pruebas. No se ejecutan más pruebas ni cambios de datos desde esa instrucción. Se interrumpió el build de frontend que estaba en curso. Los últimos ajustes de validación de DTOs y el alta inicial de propietario mediante el servicio común requieren validación por el usuario; no están certificados por los resultados anteriores.

La fase 5 queda pendiente de la validación del usuario, incluidos builds y repetición de la matriz completa de flujos. Producción no se desplegó.

La copia de producción localizada en Docker (`crm_gvr_rehearsal_20261021_test`) procede del respaldo del 9 de octubre; su último lead es de esa fecha. `crm_gvr_dev` es una base nueva migrada y estaba sin usuarios ni leads al comprobarla. No se certifica igualdad con producción actual y no se conectó a producción para actualizarla.

## Secuencia de publicación para el usuario

1. Respaldar producción y verificar la restauración.
2. Validar las pruebas y builds sobre el código final; ensayar las migraciones con una copia reciente.
3. Aplicar `prisma migrate deploy`, sin `db push` ni reset.
4. Publicar backend y comprobar salud, login, leads y chat manual.
5. Publicar frontend y comprobar los cuatro roles y el cupo.
6. Mantener `AUTOMATIZACIONES_CLIENTES_HABILITADAS=false` en el servidor. Dejar el cupo del cliente vacío o ajustarlo a su plan.
7. Rollback: volver al código anterior; la migración aditiva puede permanecer.

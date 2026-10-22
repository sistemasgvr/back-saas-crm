# Verificación de cupos de usuarios

Verificado el 21 de octubre de 2026 con «Organización de prueba»
(`organizacion-de-prueba`) en PostgreSQL real, ejecutando los servicios del
código local. No se desplegó el cambio ni se probó mediante la interfaz publicada.

## Resultado

Se reprodujo un fallo: la reactivación global desde administración SaaS actualizaba
directamente la cuenta y permitía pasar de 1 a 2 usuarios activos con límite 1.
Ahora pasa por `GestionMembresiasService`, revalida al administrador y comprueba el
cupo de las membresías activas bajo los mismos bloqueos que las altas.

Solo consumen cupo las cuentas de cliente globalmente activas con membresía activa.
Los administradores SaaS no consumen plazas. `null` significa sin límite. Reducir
el límite por debajo del uso actual conserva las cuentas existentes y bloquea
nuevas altas y reactivaciones hasta disponer de plaza.

## Prueba real sin cambios persistentes

`test/validar-cupo-empresa.rollback.cjs` requiere las variables explícitas
`CUPO_TEST_DATABASE_URL` y `CUPO_TEST_ORGANIZACION_ID`. Solo acepta la empresa con
slug `organizacion-de-prueba`, activa y sin cuentas que consuman cupo.

El script ejecutó 18 comprobaciones: altas desde empresa y SaaS, límite lleno,
ausencia de cuentas huérfanas, suspensión global, desactivación y reactivación de
membresías, reactivación global, vinculación de cuentas, edición de roles,
activaciones repetidas, consistencia de contadores, reducción/eliminación del
límite, exención SaaS y bloqueo ante otra transacción concurrente.

Todas las escrituras quedan dentro de una transacción que se revierte
obligatoriamente. Después se comparan empresa, membresías y número de eventos
con el estado inicial y se comprueba que ninguna cuenta creada permanezca.
La segunda conexión solo verifica que el bloqueo concurrente impida entrar.
No se envían notificaciones, correos ni eventos de WhatsApp.

Resultado: 18 comprobaciones correctas y restauración confirmada. La empresa
terminó nuevamente con 0 usuarios que consumen cupo y sin límite, tal como estaba.

Las regresiones unitarias están en `reactivar-cuenta-cupo.spec.ts` e incluyen
reactivaciones con cupo lleno/libre/ilimitado, cuentas ya activas, exención SaaS,
desactivación con exceso de cupo, cambios concurrentes de membresía y autorización.

Verificación del código: TypeScript y ESLint correctos. Se validaron las 296
pruebas unitarias del backend. Tres pruebas HTTP de logging requirieron repetir
su suite con acceso a puertos locales, bloqueado inicialmente por el sandbox;
la suite completa de logging pasó al repetirla con ese permiso.

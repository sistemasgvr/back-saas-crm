# Compresión de adjuntos de WhatsApp

Las cargas multipart y las cargas directas a MinIO pasan por
`ComprimirMediaWhatsAppService` antes de subir el archivo a Meta. Se conserva
en el historial la misma versión comprimida que recibe el contacto.

- Originales: videos de hasta 100 MiB e imágenes JPEG/PNG de hasta 25 MiB.
- Videos MP4, 3GP, MOV, WebM y AVI: salida MP4 H.264, píxeles yuv420p y
  audio AAC estéreo de 96 kbps si existe audio. Primer intento con lado máximo
  de 1280 píxeles y CRF 23; si supera los 16 MiB, reintenta con 960/CRF 27 y
  640/CRF 30. No amplía la imagen ni recorta la duración.
- Imágenes: lado máximo de 2560 píxeles, sin ampliar, orientación corregida,
  JPEG con calidad 85 o PNG con transparencia. Si sigue superando 5 MiB,
  convierte a JPEG de hasta 1920 píxeles y calidad 80, con fondo blanco.
  Se conserva el original cuando la primera compresión no reduce el peso.
- Audio, documentos y stickers conservan su tratamiento y límites anteriores.
- Si el resultado sigue superando los límites de Meta, devuelve un error;
  no envía un video incompleto ni reduce indefinidamente la calidad.

## Instalación y despliegue

`npm ci` instala `ffmpeg-static` (versión fijada en package-lock.json), que
descarga el ejecutable correspondiente al sistema operativo y arquitectura.
Instalar las dependencias en el servidor o durante el build de Docker; no
copiar node_modules de Windows a Linux. Si el gestor bloquea scripts de
instalación, permitir el script de `ffmpeg-static`. Opcionalmente definir
`FFMPEG_BIN` con una ruta absoluta a una instalación propia de FFmpeg con
libx264 y AAC. El ejecutable se invoca sin shell y con argumentos separados.

El Dockerfile existente copia node_modules al runtime e incluye el binario.
No requiere migraciones. El usuario del proceso necesita acceso de ejecución
al binario y escritura en el directorio temporal del sistema. Los archivos
temporales se eliminan al terminar, incluso ante errores.

Hay un máximo de dos compresiones simultáneas por proceso; las adicionales
reciben un error que permite reintentar. FFmpeg usa dos hilos de codificación,
un hilo de filtros y un plazo total de 180 segundos por video. Cada carga
original sigue ocupando memoria durante la petición; dimensionar las réplicas
y los límites de carga del proxy según la capacidad del servidor.

La ruta de Next tiene `maxDuration = 300` y espera hasta 240 segundos al backend.
El plan de hosting y los proxies deben admitir esa duración. Los archivos de
más de 4 MiB continúan subiendo directamente a MinIO para respetar el límite
del cuerpo HTTP de Vercel; esa subida contiene el original, y se comprime en
el backend al confirmar. La compresión reduce el envío a Meta y el archivo
guardado, pero no el tráfico inicial desde el navegador a MinIO.

## Verificación

`npm test -- --runInBand comprimir-media-whatsapp carga-directa-media-whatsapp`
incluye un video AVI sintético real mayor de 16 MiB, verifica que el MP4
comprimido cabe en el límite, se decodifica completo, conserva su duración y
contiene H.264/AAC. También verifica los límites de carga, las imágenes con
transparencia y el manejo de archivos dañados.

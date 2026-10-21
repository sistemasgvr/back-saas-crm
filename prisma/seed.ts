import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const MODULOS = [
  {
    codigo: 'LEADS',
    nombre: 'Leads',
    descripcion: 'Leads, agenda y pipeline',
    icono: 'mdi:account-multiple-outline',
    orden: 2,
    defaultHabilitado: 1,
  },
  {
    codigo: 'META_LEADS',
    nombre: 'Meta Leads',
    descripcion: 'Conexión e integración Meta Lead Ads',
    icono: 'mdi:facebook',
    orden: 1,
    defaultHabilitado: 1,
  },
  {
    codigo: 'DASHBOARD',
    nombre: 'Dashboard',
    descripcion: 'KPIs de leads, embudo e inversión publicitaria',
    icono: 'mdi:view-dashboard',
    orden: 2,
    defaultHabilitado: 1,
  },
  {
    codigo: 'INMUEBLES',
    nombre: 'Inmuebles',
    descripcion: 'Catálogo de inmuebles (propiedades de la organización)',
    icono: 'mdi:home-city',
    orden: 3,
    defaultHabilitado: 1,
  },
  {
    codigo: 'WHATSAPP',
    nombre: 'WhatsApp',
    descripcion: 'Inbox y mensajería WhatsApp Cloud API',
    icono: 'mdi:whatsapp',
    orden: 4,
    defaultHabilitado: 0,
  },
  {
    codigo: 'AUTOMATIZACIONES',
    nombre: 'Automatizaciones',
    descripcion: 'Reservado — sin producto completo aún',
    icono: 'mdi:robot',
    orden: 5,
    defaultHabilitado: 0,
  },
];

async function main() {
  const grupos = await Promise.all(
    ['CRM', 'META'].map((codigo, i) =>
      prisma.moduloGrupo.upsert({
        where: { codigo },
        update: {},
        create: {
          codigo,
          nombre: codigo === 'META' ? 'Meta' : codigo,
          orden: i + 1,
        },
      }),
    ),
  );
  const config = (codigo: string) => ({
    grupoId: grupos.find(
      (g) =>
        g.codigo ===
        (['DASHBOARD', 'LEADS', 'INMUEBLES'].includes(codigo) ? 'CRM' : 'META'),
    )!.id,
    requiere:
      codigo === 'AUTOMATIZACIONES'
        ? ['WHATSAPP']
        : ['META_LEADS', 'WHATSAPP'].includes(codigo)
          ? ['LEADS']
          : [],
    orden: ['DASHBOARD', 'META_LEADS'].includes(codigo)
      ? 1
      : ['LEADS', 'WHATSAPP'].includes(codigo)
        ? 2
        : 3,
  });
  const modulos = await Promise.all(
    MODULOS.map(({ codigo, nombre, descripcion, icono, orden }) =>
      prisma.modulo.upsert({
        where: { codigo },
        update: { nombre, descripcion, icono, ...config(codigo) },
        create: { codigo, nombre, descripcion, icono, ...config(codigo) },
      }),
    ),
  );

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios en .env',
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: { passwordHash, esAdminPlataforma: 1 },
    create: {
      email: adminEmail,
      passwordHash,
      nombre: process.env.SEED_ADMIN_NOMBRE ?? 'Admin',
      apellido: process.env.SEED_ADMIN_APELLIDO ?? null,
      esAdminPlataforma: 1,
    },
  });

  const orgPrueba = await prisma.organizacion.upsert({
    where: { slug: 'organizacion-de-prueba' },
    update: {},
    create: {
      nombre: 'Organización de prueba',
      slug: 'organizacion-de-prueba',
    },
  });

  await Promise.all(
    modulos.map((modulo) => {
      const meta = MODULOS.find((m) => m.codigo === modulo.codigo)!;
      return prisma.organizacionModulo.upsert({
        where: {
          organizacionId_moduloId: {
            organizacionId: orgPrueba.id,
            moduloId: modulo.id,
          },
        },
        update: {},
        create: {
          organizacionId: orgPrueba.id,
          moduloId: modulo.id,
          habilitado: meta.defaultHabilitado,
          fechaActivacion: meta.defaultHabilitado ? new Date() : null,
        },
      });
    }),
  );

  console.log(
    `Seed OK — admin: ${adminEmail} · org de prueba: ${orgPrueba.slug}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

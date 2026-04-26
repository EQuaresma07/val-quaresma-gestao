/**
 * SEED INICIAL DO BANCO
 *
 * Roda com: npm run db:seed
 *
 * Cria:
 * - Usuário admin (login: admin@atelier.com / senha: admin123 — TROCAR EM PRODUÇÃO!)
 * - Tamanhos padrão (PP, P, M, G, GG + numéricos 36-46)
 * - Cores básicas
 * - Categorias iniciais
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ============================================
  // USUÁRIO ADMIN
  // ============================================
  const adminEmail = 'admin@atelier.com';
  const adminPassword = 'admin123'; // TROCAR EM PRODUÇÃO

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Usuário admin criado:`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword}`);
    console.log(`   ⚠️  TROQUE A SENHA NO PRIMEIRO LOGIN!\n`);
  } else {
    console.log('ℹ️  Usuário admin já existe, pulando.\n');
  }

  // ============================================
  // TAMANHOS — letras
  // ============================================
  const letterSizes = [
    { name: 'PP', order: 1 },
    { name: 'P', order: 2 },
    { name: 'M', order: 3 },
    { name: 'G', order: 4 },
    { name: 'GG', order: 5 },
    { name: 'XG', order: 6 },
  ];

  for (const s of letterSizes) {
    await prisma.size.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, displayOrder: s.order, category: 'letter' },
    });
  }
  console.log(`✅ ${letterSizes.length} tamanhos por letra criados`);

  // ============================================
  // TAMANHOS — numéricos (calça/saia/short)
  // ============================================
  const numericSizes = [36, 38, 40, 42, 44, 46, 48, 50];
  for (let i = 0; i < numericSizes.length; i++) {
    await prisma.size.upsert({
      where: { name: String(numericSizes[i]) },
      update: {},
      create: {
        name: String(numericSizes[i]),
        displayOrder: 100 + i,
        category: 'numeric',
      },
    });
  }
  console.log(`✅ ${numericSizes.length} tamanhos numéricos criados`);

  // ============================================
  // TAMANHO ÚNICO
  // ============================================
  await prisma.size.upsert({
    where: { name: 'Único' },
    update: {},
    create: { name: 'Único', displayOrder: 0, category: 'unique' },
  });
  console.log(`✅ Tamanho "Único" criado`);

  // ============================================
  // CORES BÁSICAS
  // ============================================
  const colors = [
    { name: 'Preto', hex: '#000000' },
    { name: 'Branco', hex: '#FFFFFF' },
    { name: 'Cinza', hex: '#808080' },
    { name: 'Bege', hex: '#D4B896' },
    { name: 'Marrom', hex: '#6B4423' },
    { name: 'Azul', hex: '#1E40AF' },
    { name: 'Azul Marinho', hex: '#1E3A5F' },
    { name: 'Vermelho', hex: '#DC2626' },
    { name: 'Verde', hex: '#15803D' },
    { name: 'Amarelo', hex: '#FACC15' },
    { name: 'Rosa', hex: '#EC4899' },
    { name: 'Roxo', hex: '#7C3AED' },
    { name: 'Floral', hex: '#FF8FA3' },
    { name: 'Estampado', hex: '#A0A0A0' },
  ];

  for (const c of colors) {
    await prisma.color.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, hexCode: c.hex },
    });
  }
  console.log(`✅ ${colors.length} cores criadas`);

  // ============================================
  // CATEGORIAS
  // ============================================
  const rootCategories = [
    { name: 'Feminino', slug: 'feminino' },
    { name: 'Masculino', slug: 'masculino' },
    { name: 'Unissex', slug: 'unissex' },
    { name: 'Acessórios', slug: 'acessorios' },
    { name: 'Calçados', slug: 'calcados' },
  ];

  for (const c of rootCategories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug },
    });
  }
  console.log(`✅ ${rootCategories.length} categorias raiz criadas`);

  // Subcategorias femininas
  const femininoCat = await prisma.category.findUnique({
    where: { slug: 'feminino' },
  });

  if (femininoCat) {
    const femSubs = [
      { name: 'Vestidos', slug: 'feminino-vestidos' },
      { name: 'Blusas', slug: 'feminino-blusas' },
      { name: 'Calças', slug: 'feminino-calcas' },
      { name: 'Saias', slug: 'feminino-saias' },
      { name: 'Jaquetas', slug: 'feminino-jaquetas' },
    ];

    for (const s of femSubs) {
      await prisma.category.upsert({
        where: { slug: s.slug },
        update: {},
        create: {
          name: s.name,
          slug: s.slug,
          parentId: femininoCat.id,
        },
      });
    }
    console.log(`✅ ${femSubs.length} subcategorias femininas criadas`);
  }

  console.log('\n🎉 Seed concluído!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

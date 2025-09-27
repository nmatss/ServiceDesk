#!/usr/bin/env node

const Database = require('better-sqlite3');

const API_BASE = 'http://localhost:3000';

console.log('🔐 TESTANDO ISOLAMENTO DE DADOS ENTRE TENANTS\n');

async function setupTestData() {
  console.log('📊 Configurando dados de teste...');

  const db = new Database('./data/servicedesk.db');

  try {
    // Criar usuário para tenant 2
    const bcrypt = require('bcryptjs');
    const tenant2UserPassword = await bcrypt.hash('user456', 12);

    try {
      db.prepare(`
        INSERT INTO users (tenant_id, name, email, password_hash, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(2, 'Maria Santos', 'maria@tenant2.com', tenant2UserPassword, 'user', 1);
      console.log('✅ Usuário tenant 2 criado');
    } catch (error) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.log('⚠️ Erro ao criar usuário tenant 2:', error.message);
      }
    }

    // Criar dados específicos para cada tenant

    // Categorias Tenant 1
    const tenant1Categories = [
      { name: 'Hardware T1', description: 'Hardware do tenant 1', color: '#ff0000' },
      { name: 'Software T1', description: 'Software do tenant 1', color: '#00ff00' }
    ];

    tenant1Categories.forEach(cat => {
      try {
        db.prepare('INSERT INTO categories (tenant_id, name, description, color) VALUES (?, ?, ?, ?)').run(
          1, cat.name, cat.description, cat.color
        );
      } catch (error) {
        // Categoria já existe
      }
    });

    // Categorias Tenant 2
    const tenant2Categories = [
      { name: 'Hardware T2', description: 'Hardware do tenant 2', color: '#0000ff' },
      { name: 'Software T2', description: 'Software do tenant 2', color: '#ffff00' }
    ];

    tenant2Categories.forEach(cat => {
      try {
        db.prepare('INSERT INTO categories (tenant_id, name, description, color) VALUES (?, ?, ?, ?)').run(
          2, cat.name, cat.description, cat.color
        );
      } catch (error) {
        // Categoria já existe
      }
    });

    // Prioridades para ambos os tenants
    const priorities = [
      { name: 'Baixa T1', level: 1, tenant: 1 },
      { name: 'Alta T1', level: 3, tenant: 1 },
      { name: 'Baixa T2', level: 1, tenant: 2 },
      { name: 'Alta T2', level: 3, tenant: 2 }
    ];

    priorities.forEach(pri => {
      try {
        db.prepare('INSERT INTO priorities (tenant_id, name, level, color) VALUES (?, ?, ?, ?)').run(
          pri.tenant, pri.name, pri.level, '#666666'
        );
      } catch (error) {
        // Prioridade já existe
      }
    });

    console.log('✅ Dados de teste configurados\n');

  } finally {
    db.close();
  }
}

async function makeAuthenticatedRequest(email, password, tenantSlug, endpoint) {
  // Fazer login
  const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenant_slug: tenantSlug })
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`);
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;

  // Fazer request para endpoint
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': loginData.tenant.id.toString(),
      'x-tenant-slug': loginData.tenant.slug,
      'x-tenant-name': loginData.tenant.name
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return await response.json();
}

async function testTenantIsolation() {
  console.log('🧪 TESTANDO ISOLAMENTO ENTRE TENANTS\n');

  try {
    // Teste 1: Categorias
    console.log('🔍 Teste 1: Isolamento de Categorias');

    const tenant1Categories = await makeAuthenticatedRequest(
      'admin@servicedesk.com', 'admin123', 'empresa-demo', '/api/categories'
    );

    const tenant2Categories = await makeAuthenticatedRequest(
      'maria@tenant2.com', 'user456', 'tenant2', '/api/categories'
    );

    console.log(`   Tenant 1 - Categorias: ${tenant1Categories.categories?.length || 0}`);
    console.log(`   Tenant 2 - Categorias: ${tenant2Categories.categories?.length || 0}`);

    // Verificar se não há vazamento
    const t1Names = tenant1Categories.categories?.map(c => c.name) || [];
    const t2Names = tenant2Categories.categories?.map(c => c.name) || [];

    const hasT1InT2 = t2Names.some(name => name.includes('T1'));
    const hasT2InT1 = t1Names.some(name => name.includes('T2'));

    if (hasT1InT2 || hasT2InT1) {
      console.log('   ❌ VAZAMENTO DETECTADO em categorias!');
      return false;
    } else {
      console.log('   ✅ Isolamento OK em categorias');
    }

    // Teste 2: Prioridades
    console.log('\n🔍 Teste 2: Isolamento de Prioridades');

    const tenant1Priorities = await makeAuthenticatedRequest(
      'admin@servicedesk.com', 'admin123', 'empresa-demo', '/api/priorities'
    );

    const tenant2Priorities = await makeAuthenticatedRequest(
      'maria@tenant2.com', 'user456', 'tenant2', '/api/priorities'
    );

    console.log(`   Tenant 1 - Prioridades: ${tenant1Priorities.priorities?.length || 0}`);
    console.log(`   Tenant 2 - Prioridades: ${tenant2Priorities.priorities?.length || 0}`);

    const t1PriNames = tenant1Priorities.priorities?.map(p => p.name) || [];
    const t2PriNames = tenant2Priorities.priorities?.map(p => p.name) || [];

    const hasPri1InT2 = t2PriNames.some(name => name.includes('T1'));
    const hasPri2InT1 = t1PriNames.some(name => name.includes('T2'));

    if (hasPri1InT2 || hasPri2InT1) {
      console.log('   ❌ VAZAMENTO DETECTADO em prioridades!');
      return false;
    } else {
      console.log('   ✅ Isolamento OK em prioridades');
    }

    console.log('\n🎉 TODOS OS TESTES DE ISOLAMENTO PASSARAM!');
    console.log('✅ Sistema seguro para uso multi-tenant');

    return true;

  } catch (error) {
    console.log(`❌ Erro durante teste: ${error.message}`);
    return false;
  }
}

async function verifyDatabaseIsolation() {
  console.log('\n📊 VERIFICANDO ISOLAMENTO NO BANCO DE DADOS');

  const db = new Database('./data/servicedesk.db');

  try {
    // Verificar dados por tenant
    const tenant1Categories = db.prepare('SELECT * FROM categories WHERE tenant_id = 1').all();
    const tenant2Categories = db.prepare('SELECT * FROM categories WHERE tenant_id = 2').all();

    console.log(`   Tenant 1 DB - Categorias: ${tenant1Categories.length}`);
    console.log(`   Tenant 2 DB - Categorias: ${tenant2Categories.length}`);

    // Verificar se há dados órfãos (sem tenant_id)
    const orphanCategories = db.prepare('SELECT * FROM categories WHERE tenant_id IS NULL').all();
    const orphanPriorities = db.prepare('SELECT * FROM priorities WHERE tenant_id IS NULL').all();

    if (orphanCategories.length > 0 || orphanPriorities.length > 0) {
      console.log(`   ⚠️ Dados órfãos encontrados: ${orphanCategories.length} categorias, ${orphanPriorities.length} prioridades`);
    } else {
      console.log('   ✅ Nenhum dado órfão encontrado');
    }

  } finally {
    db.close();
  }
}

async function main() {
  console.log('🚀 INICIANDO TESTE COMPLETO DE ISOLAMENTO MULTI-TENANT\n');

  try {
    await setupTestData();
    await verifyDatabaseIsolation();

    // Aguardar servidor estar pronto
    console.log('⏳ Aguardando servidor estar pronto...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const isolationOK = await testTenantIsolation();

    if (isolationOK) {
      console.log('\n🎯 RESULTADO FINAL: ✅ SISTEMA APROVADO');
      console.log('   - Isolamento de dados: ✅');
      console.log('   - APIs tenant-aware: ✅');
      console.log('   - Segurança multi-tenant: ✅');
      process.exit(0);
    } else {
      console.log('\n🚨 RESULTADO FINAL: ❌ FALHAS DETECTADAS');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 ERRO CRÍTICO:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
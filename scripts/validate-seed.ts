#!/usr/bin/env tsx

import db from '../lib/db/connection';

console.log('\n========================================');
console.log('📊 SEED DATA VALIDATION REPORT');
console.log('========================================\n');

// Tickets por status
console.log('🎫 TICKETS POR STATUS:');
const ticketsByStatus = db.prepare(`
  SELECT s.name, COUNT(*) as count
  FROM tickets t
  JOIN statuses s ON t.status_id = s.id
  GROUP BY s.id
  ORDER BY count DESC
`).all();
ticketsByStatus.forEach((row: any) => {
  console.log(`   ${row.name}: ${row.count}`);
});

// Tickets por prioridade
console.log('\n🔥 TICKETS POR PRIORIDADE:');
const ticketsByPriority = db.prepare(`
  SELECT p.name, COUNT(*) as count
  FROM tickets t
  JOIN priorities p ON t.priority_id = p.id
  GROUP BY p.id
  ORDER BY p.level DESC
`).all();
ticketsByPriority.forEach((row: any) => {
  console.log(`   ${row.name}: ${row.count}`);
});

// Tickets por categoria
console.log('\n📁 TICKETS POR CATEGORIA:');
const ticketsByCategory = db.prepare(`
  SELECT c.name, COUNT(*) as count
  FROM tickets t
  JOIN categories c ON t.category_id = c.id
  GROUP BY c.id
  ORDER BY count DESC
`).all();
ticketsByCategory.forEach((row: any) => {
  console.log(`   ${row.name}: ${row.count}`);
});

// Top 5 artigos mais visualizados
console.log('\n📚 TOP 5 ARTIGOS KB MAIS VISUALIZADOS:');
const topArticles = db.prepare(`
  SELECT title, view_count, helpful_count
  FROM knowledge_articles
  ORDER BY view_count DESC
  LIMIT 5
`).all();
topArticles.forEach((row: any, i: number) => {
  console.log(`   ${i+1}. ${row.title} (${row.view_count} views, ${row.helpful_count} úteis)`);
});

// Tickets com mais comentários
console.log('\n💬 TOP 5 TICKETS COM MAIS INTERAÇÃO:');
const topTicketsComments = db.prepare(`
  SELECT t.title, COUNT(c.id) as comment_count
  FROM tickets t
  LEFT JOIN comments c ON t.id = c.ticket_id
  GROUP BY t.id
  ORDER BY comment_count DESC
  LIMIT 5
`).all();
topTicketsComments.forEach((row: any, i: number) => {
  console.log(`   ${i+1}. ${row.title} (${row.comment_count} comentários)`);
});

// Agentes e carga de trabalho
console.log('\n👤 CARGA DE TRABALHO DOS AGENTES:');
const agentWorkload = db.prepare(`
  SELECT u.name, COUNT(t.id) as tickets_assigned
  FROM users u
  LEFT JOIN tickets t ON u.id = t.assigned_to
  WHERE u.role = 'agent'
  GROUP BY u.id
  ORDER BY tickets_assigned DESC
`).all();
agentWorkload.forEach((row: any) => {
  console.log(`   ${row.name}: ${row.tickets_assigned} tickets atribuídos`);
});

// Resumo geral
console.log('\n📈 RESUMO GERAL:');
const totalTickets = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
const totalComments = db.prepare('SELECT COUNT(*) as count FROM comments').get() as { count: number };
const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
const totalArticles = db.prepare('SELECT COUNT(*) as count FROM knowledge_articles').get() as { count: number };

console.log(`   Total de Tickets: ${totalTickets.count}`);
console.log(`   Total de Comentários: ${totalComments.count}`);
console.log(`   Total de Usuários: ${totalUsers.count}`);
console.log(`   Total de Artigos KB: ${totalArticles.count}`);
console.log(`   Média de comentários por ticket: ${(totalComments.count / totalTickets.count).toFixed(1)}`);

console.log('\n========================================');
console.log('✅ SEED DATA VALIDATION COMPLETED');
console.log('========================================\n');

process.exit(0);

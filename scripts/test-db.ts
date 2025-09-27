#!/usr/bin/env tsx

/**
 * Script para testar o banco de dados
 * Uso: npm run test-db
 */

import { 
  userQueries, 
  ticketQueries, 
  categoryQueries, 
  priorityQueries, 
  statusQueries,
  commentQueries 
} from '../lib/db';

async function testDatabase() {
  console.log('🧪 Testing ServiceDesk Database...\n');

  try {
    // Testar usuários
    console.log('👥 Testing Users...');
    const users = userQueries.getAll();
    console.log(`✅ Found ${users.length} users`);
    
    const admin = userQueries.getByRole('admin');
    console.log(`✅ Found ${admin.length} admin users`);
    
    const agents = userQueries.getByRole('agent');
    console.log(`✅ Found ${agents.length} agent users`);

    // Testar categorias
    console.log('\n📂 Testing Categories...');
    const categories = categoryQueries.getAll();
    console.log(`✅ Found ${categories.length} categories`);

    // Testar prioridades
    console.log('\n⚡ Testing Priorities...');
    const priorities = priorityQueries.getAll();
    console.log(`✅ Found ${priorities.length} priorities`);

    // Testar status
    console.log('\n📊 Testing Statuses...');
    const statuses = statusQueries.getAll();
    console.log(`✅ Found ${statuses.length} statuses`);
    
    const nonFinalStatuses = statusQueries.getNonFinal();
    console.log(`✅ Found ${nonFinalStatuses.length} non-final statuses`);

    // Testar tickets
    console.log('\n🎫 Testing Tickets...');
    const tickets = ticketQueries.getAll();
    console.log(`✅ Found ${tickets.length} tickets`);
    
    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      console.log(`✅ First ticket: "${firstTicket.title}" by ${firstTicket.user.name}`);
      
      // Testar comentários
      console.log('\n💬 Testing Comments...');
      const comments = commentQueries.getByTicketId(firstTicket.id);
      console.log(`✅ Found ${comments.length} comments for ticket ${firstTicket.id}`);
      
      if (comments.length > 0) {
        const firstComment = comments[0];
        console.log(`✅ First comment by ${firstComment.user.name}: "${firstComment.content.substring(0, 50)}..."`);
      }
    }

    // Testar queries específicas
    console.log('\n🔍 Testing Specific Queries...');
    
    if (users.length > 0) {
      const userTickets = ticketQueries.getByUserId(users[0].id);
      console.log(`✅ User ${users[0].name} has ${userTickets.length} tickets`);
    }
    
    if (agents.length > 0) {
      const agentTickets = ticketQueries.getByAssignedTo(agents[0].id);
      console.log(`✅ Agent ${agents[0].name} is assigned to ${agentTickets.length} tickets`);
    }

    console.log('\n✅ All database tests passed!');
    console.log('\n📊 Database Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Priorities: ${priorities.length}`);
    console.log(`   Statuses: ${statuses.length}`);
    console.log(`   Tickets: ${tickets.length}`);
    console.log(`   Comments: ${tickets.reduce((sum, ticket) => sum + ticket.comments_count, 0)}`);

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase().catch((error) => {
  console.error('❌ Error during database test:', error);
  process.exit(1);
});

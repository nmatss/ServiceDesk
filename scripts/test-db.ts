#!/usr/bin/env tsx

/**
 * Script para testar o banco de dados
 * Uso: npm run test-db
 */

import { logger } from '@/lib/monitoring/logger';
import {
  userQueries,
  ticketQueries,
  categoryQueries,
  priorityQueries,
  statusQueries,
  commentQueries
} from '../lib/db';

async function testDatabase() {
  logger.info('🧪 Testing ServiceDesk Database...\n');

  try {
    // Testar usuários
    logger.info('👥 Testing Users...');
    const users = userQueries.getAll();
    logger.info(`✅ Found ${users.length} users`);
    
    const admin = userQueries.getByRole('admin');
    logger.info(`✅ Found ${admin.length} admin users`);
    
    const agents = userQueries.getByRole('agent');
    logger.info(`✅ Found ${agents.length} agent users`);

    // Testar categorias
    logger.info('\n📂 Testing Categories...');
    const categories = categoryQueries.getAll();
    logger.info(`✅ Found ${categories.length} categories`);

    // Testar prioridades
    logger.info('\n⚡ Testing Priorities...');
    const priorities = priorityQueries.getAll();
    logger.info(`✅ Found ${priorities.length} priorities`);

    // Testar status
    logger.info('\n📊 Testing Statuses...');
    const statuses = statusQueries.getAll();
    logger.info(`✅ Found ${statuses.length} statuses`);
    
    const nonFinalStatuses = statusQueries.getNonFinal();
    logger.info(`✅ Found ${nonFinalStatuses.length} non-final statuses`);

    // Testar tickets
    logger.info('\n🎫 Testing Tickets...');
    const tickets = ticketQueries.getAll();
    logger.info(`✅ Found ${tickets.length} tickets`);
    
    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      logger.info(`✅ First ticket: "${firstTicket.title}" by ${firstTicket.user.name}`);
      
      // Testar comentários
      logger.info('\n💬 Testing Comments...');
      const comments = commentQueries.getByTicketId(firstTicket.id);
      logger.info(`✅ Found ${comments.length} comments for ticket ${firstTicket.id}`);
      
      if (comments.length > 0) {
        const firstComment = comments[0];
        logger.info(`✅ First comment by ${firstComment.user.name}: "${firstComment.content.substring(0, 50)}..."`);
      }
    }

    // Testar queries específicas
    logger.info('\n🔍 Testing Specific Queries...');
    
    if (users.length > 0) {
      const userTickets = ticketQueries.getByUserId(users[0].id);
      logger.info(`✅ User ${users[0].name} has ${userTickets.length} tickets`);
    }
    
    if (agents.length > 0) {
      const agentTickets = ticketQueries.getByAssignedTo(agents[0].id);
      logger.info(`✅ Agent ${agents[0].name} is assigned to ${agentTickets.length} tickets`);
    }

    logger.info('\n✅ All database tests passed!');
    logger.info('\n📊 Database Summary');
    logger.info(`   Users: ${users.length}`);
    logger.info(`   Categories: ${categories.length}`);
    logger.info(`   Priorities: ${priorities.length}`);
    logger.info(`   Statuses: ${statuses.length}`);
    logger.info(`   Tickets: ${tickets.length}`);
    logger.info(`   Comments: ${tickets.reduce((sum, ticket) => sum + ticket.comments_count, 0)}`);

  } catch (error) {
    logger.error('❌ Database test failed', error);
    process.exit(1);
  }
}

testDatabase().catch((error) => {
  logger.error('❌ Error during database test', error);
  process.exit(1);
});

/**
 * Seed test notifications for development
 */

import db from '../lib/db/connection'

const notificationTypes = [
  {
    type: 'ticket_assigned',
    title: 'Novo Ticket Atribuído',
    message: 'Ticket #1001 foi atribuído a você',
    data: { ticketId: 1 }
  },
  {
    type: 'ticket_updated',
    title: 'Ticket Atualizado',
    message: 'Status do ticket #1002 foi alterado para "Em Progresso"',
    data: { ticketId: 2, oldStatus: 'Aberto', newStatus: 'Em Progresso' }
  },
  {
    type: 'comment_added',
    title: 'Novo Comentário',
    message: 'Um novo comentário foi adicionado ao ticket #1003',
    data: { ticketId: 3, commentBy: 'João Silva' }
  },
  {
    type: 'ticket_resolved',
    title: 'Ticket Resolvido',
    message: 'Ticket #1004 foi resolvido com sucesso',
    data: { ticketId: 4 }
  },
  {
    type: 'sla_warning',
    title: 'Aviso de SLA',
    message: '⚠️ Ticket #1005 está próximo do vencimento do SLA (2h restantes)',
    data: { ticketId: 5, timeRemaining: '2h' }
  },
  {
    type: 'sla_breach',
    title: 'Violação de SLA',
    message: '🔴 SLA violado no ticket #1006',
    data: { ticketId: 6, breachTime: '1h 30m' }
  },
  {
    type: 'ticket_escalated',
    title: 'Ticket Escalado',
    message: 'Ticket #1007 foi escalado para o nível 2',
    data: { ticketId: 7, escalationLevel: 2 }
  },
  {
    type: 'system_alert',
    title: 'Alerta do Sistema',
    message: 'Atualização do sistema agendada para hoje às 23:00',
    data: { scheduledTime: '23:00' }
  }
]

async function seedNotifications() {
  console.log('Starting notification seeding...')

  try {
    // Get all active users
    const users = db.prepare('SELECT id, tenant_id, name, role FROM users WHERE is_active = 1').all() as any[]

    if (users.length === 0) {
      console.error('No active users found. Please run database initialization first.')
      process.exit(1)
    }

    console.log(`Found ${users.length} active users. Seeding notifications...`)

    // Clear existing notifications
    const deleteResult = db.prepare('DELETE FROM notifications').run()
    console.log(`Cleared ${deleteResult.changes} existing notifications`)

    // Insert test notifications
    const insertStmt = db.prepare(`
      INSERT INTO notifications (
        user_id,
        tenant_id,
        type,
        title,
        message,
        data,
        ticket_id,
        is_read,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' minutes'))
    `)

    let totalCreated = 0

    // Create notifications for each user
    for (const user of users) {
      // Determine number of notifications based on role
      const notifCount = user.role === 'admin' ? 12 : user.role === 'agent' ? 8 : 5

      // Create standard notifications
      notificationTypes.slice(0, notifCount).forEach((notif, index) => {
        // Create some as read, some as unread (40% read, 60% unread for testing)
        const isRead = Math.random() < 0.4 ? 1 : 0
        const minutesAgo = index * 20 + Math.floor(Math.random() * 10) // Spread them out over time

        insertStmt.run(
          user.id,
          user.tenant_id,
          notif.type,
          notif.title,
          notif.message,
          JSON.stringify(notif.data),
          notif.data.ticketId || null,
          isRead,
          minutesAgo
        )
        totalCreated++
      })

      // Add recent notifications (unread) for agents and admins
      if (user.role === 'admin' || user.role === 'agent') {
        const recentNotifications = [
          {
            type: 'comment_added',
            title: 'Resposta Rápida Necessária',
            message: 'Cliente respondeu ao ticket aguardando retorno urgente',
            data: { ticketId: Math.floor(Math.random() * 10) + 1, priority: 'high' },
            minutesAgo: 2
          },
          {
            type: 'ticket_assigned',
            title: 'Novo Ticket VIP',
            message: 'Ticket de cliente VIP foi atribuído a você',
            data: { ticketId: Math.floor(Math.random() * 10) + 1, vip: true },
            minutesAgo: 5
          }
        ]

        recentNotifications.forEach((notif) => {
          insertStmt.run(
            user.id,
            user.tenant_id,
            notif.type,
            notif.title,
            notif.message,
            JSON.stringify(notif.data),
            notif.data.ticketId || null,
            0, // unread
            notif.minutesAgo
          )
          totalCreated++
        })
      }
    }

    // Count results by type
    const typeStats = db.prepare(`
      SELECT
        type,
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
      FROM notifications
      GROUP BY type
      ORDER BY total DESC
    `).all()

    // Count results by user
    const userStats = db.prepare(`
      SELECT
        u.name,
        u.role,
        COUNT(n.id) as total,
        SUM(CASE WHEN n.is_read = 0 THEN 1 ELSE 0 END) as unread
      FROM users u
      LEFT JOIN notifications n ON u.id = n.user_id
      WHERE u.is_active = 1
      GROUP BY u.id, u.name, u.role
      ORDER BY unread DESC
    `).all()

    console.log(`\n✅ Seeding complete!`)
    console.log(`   Total notifications created: ${totalCreated}`)
    console.log(`   For ${users.length} users`)

    console.log('\n📊 Notifications by type:')
    console.table(typeStats)

    console.log('\n👥 Notifications by user:')
    console.table(userStats)

  } catch (error) {
    console.error('❌ Error seeding notifications:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  seedNotifications()
}

export default seedNotifications

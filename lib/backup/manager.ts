import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { createGzip } from 'zlib'
import { pipeline } from 'stream/promises'
import db from '../db/connection'
import { logger } from '../monitoring/logger'

interface BackupConfig {
  enabled: boolean
  schedule: string // cron format
  retention: {
    daily: number
    weekly: number
    monthly: number
  }
  compression: boolean
  encryptionKey?: string
  destinations: BackupDestination[]
}

interface BackupDestination {
  type: 'local' | 's3' | 'ftp'
  config: any
  enabled: boolean
}

interface BackupResult {
  success: boolean
  filename: string
  size: number
  duration: number
  error?: string
  checksum?: string
}

class BackupManager {
  private config: BackupConfig
  private backupDir: string
  private isRunning = false

  constructor(config?: Partial<BackupConfig>) {
    this.config = {
      enabled: true,
      schedule: '0 2 * * *', // Todo dia às 2h da manhã
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 12
      },
      compression: true,
      destinations: [
        {
          type: 'local',
          config: { path: './backups' },
          enabled: true
        }
      ],
      ...config
    }

    this.backupDir = path.join(process.cwd(), 'backups')
    this.initializeBackupSystem()
  }

  /**
   * Inicializar sistema de backup
   */
  private initializeBackupSystem() {
    if (!this.config.enabled) {
      logger.info('Backup system disabled')
      return
    }

    try {
      // Criar diretório de backup
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true })
      }

      // Criar subdiretórios
      ['daily', 'weekly', 'monthly'].forEach(type => {
        const dir = path.join(this.backupDir, type)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir)
        }
      })

      logger.info('Backup system initialized', { backupDir: this.backupDir })

      // Configurar scheduler se estiver em produção
      if (process.env.NODE_ENV === 'production') {
        this.scheduleBackups()
      }
    } catch (error) {
      logger.error('Failed to initialize backup system', error)
    }
  }

  /**
   * Configurar agendamento de backups
   */
  private scheduleBackups() {
    // Implementação básica - em produção usar node-cron ou similar
    const now = new Date()
    const nextBackup = new Date(now)
    nextBackup.setHours(2, 0, 0, 0) // 2h da manhã

    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1)
    }

    const timeUntilBackup = nextBackup.getTime() - now.getTime()

    setTimeout(() => {
      this.performScheduledBackup()
      // Reagendar para o próximo dia
      setInterval(() => {
        this.performScheduledBackup()
      }, 24 * 60 * 60 * 1000)
    }, timeUntilBackup)

    logger.info('Backup scheduled', { nextBackup: nextBackup.toISOString() })
  }

  /**
   * Executar backup agendado
   */
  private async performScheduledBackup() {
    try {
      const today = new Date()
      const isFirstDayOfWeek = today.getDay() === 1 // Segunda-feira
      const isFirstDayOfMonth = today.getDate() === 1

      let backupType = 'daily'
      if (isFirstDayOfMonth) {
        backupType = 'monthly'
      } else if (isFirstDayOfWeek) {
        backupType = 'weekly'
      }

      const result = await this.createBackup(backupType as 'daily' | 'weekly' | 'monthly')

      if (result.success) {
        logger.info('Scheduled backup completed', { type: backupType, result })
        await this.cleanupOldBackups()
      } else {
        logger.error('Scheduled backup failed', { type: backupType, error: result.error })
      }
    } catch (error) {
      logger.error('Error in scheduled backup', error)
    }
  }

  /**
   * Criar backup do banco de dados
   */
  async createBackup(type: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<BackupResult> {
    if (this.isRunning) {
      return {
        success: false,
        filename: '',
        size: 0,
        duration: 0,
        error: 'Backup already running'
      }
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      logger.info('Starting database backup', { type })

      // Gerar nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `servicedesk_${type}_${timestamp}.db`
      const filepath = path.join(this.backupDir, type, filename)

      // Criar backup usando SQLite backup API ou file copy
      await this.createDatabaseBackup(filepath)

      let finalPath = filepath

      // Comprimir se habilitado
      if (this.config.compression) {
        const compressedPath = `${filepath}.gz`
        await this.compressFile(filepath, compressedPath)
        fs.unlinkSync(filepath) // Remove arquivo original
        finalPath = compressedPath
      }

      // Calcular checksum
      const checksum = await this.calculateChecksum(finalPath)

      // Obter tamanho do arquivo
      const stats = fs.statSync(finalPath)

      const result: BackupResult = {
        success: true,
        filename: path.basename(finalPath),
        size: stats.size,
        duration: Date.now() - startTime,
        checksum
      }

      logger.info('Database backup completed', result)

      // Enviar para destinos configurados
      await this.uploadToDestinations(finalPath, result)

      return result
    } catch (error) {
      logger.error('Database backup failed', error)
      return {
        success: false,
        filename: '',
        size: 0,
        duration: Date.now() - startTime,
        error: error.message
      }
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Criar backup do banco de dados
   */
  private async createDatabaseBackup(destinationPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Usar o método backup do SQLite para criar uma cópia consistente
        const backup = db.backup(destinationPath)

        backup.step(-1) // Fazer backup de todas as páginas
        backup.finish()

        logger.debug('Database backup file created', { destinationPath })
        resolve()
      } catch (error) {
        // Fallback: copiar arquivo diretamente
        try {
          const dbPath = path.join(process.cwd(), 'data/servicedesk.db')
          fs.copyFileSync(dbPath, destinationPath)
          logger.debug('Database backup created via file copy', { destinationPath })
          resolve()
        } catch (copyError) {
          reject(copyError)
        }
      }
    })
  }

  /**
   * Comprimir arquivo
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const gzip = createGzip({ level: 9 })
    const source = fs.createReadStream(inputPath)
    const destination = fs.createWriteStream(outputPath)

    await pipeline(source, gzip, destination)
    logger.debug('File compressed', { inputPath, outputPath })
  }

  /**
   * Calcular checksum MD5
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto')
      const hash = crypto.createHash('md5')
      const stream = fs.createReadStream(filePath)

      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Enviar backup para destinos configurados
   */
  private async uploadToDestinations(filePath: string, result: BackupResult): Promise<void> {
    for (const destination of this.config.destinations) {
      if (!destination.enabled) continue

      try {
        switch (destination.type) {
          case 'local':
            // Já está local, apenas log
            logger.debug('Backup stored locally', { path: filePath })
            break

          case 's3':
            await this.uploadToS3(filePath, destination.config, result)
            break

          case 'ftp':
            await this.uploadToFTP(filePath, destination.config, result)
            break
        }
      } catch (error) {
        logger.error('Failed to upload backup to destination', {
          destination: destination.type,
          error: error.message
        })
      }
    }
  }

  /**
   * Upload para S3 (placeholder - requer AWS SDK)
   */
  private async uploadToS3(filePath: string, config: any, result: BackupResult): Promise<void> {
    logger.info('S3 upload not implemented', { filePath, config })
    // Implementar com AWS SDK se necessário
  }

  /**
   * Upload para FTP (placeholder)
   */
  private async uploadToFTP(filePath: string, config: any, result: BackupResult): Promise<void> {
    logger.info('FTP upload not implemented', { filePath, config })
    // Implementar com biblioteca FTP se necessário
  }

  /**
   * Limpar backups antigos
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      for (const [type, retention] of Object.entries(this.config.retention)) {
        const backupTypeDir = path.join(this.backupDir, type)

        if (!fs.existsSync(backupTypeDir)) continue

        const files = fs.readdirSync(backupTypeDir)
          .map(filename => ({
            filename,
            path: path.join(backupTypeDir, filename),
            stats: fs.statSync(path.join(backupTypeDir, filename))
          }))
          .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())

        // Manter apenas o número configurado de backups
        const filesToDelete = files.slice(retention)

        for (const file of filesToDelete) {
          fs.unlinkSync(file.path)
          logger.debug('Old backup deleted', { filename: file.filename, type })
        }

        if (filesToDelete.length > 0) {
          logger.info('Old backups cleaned up', {
            type,
            deleted: filesToDelete.length,
            retained: retention
          })
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old backups', error)
    }
  }

  /**
   * Restaurar backup
   */
  async restoreBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.warn('Starting database restore', { backupPath })

      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found')
      }

      // Verificar se o arquivo está comprimido
      let sourceFile = backupPath
      if (backupPath.endsWith('.gz')) {
        // Descomprimir
        const decompressedPath = backupPath.replace('.gz', '')
        await this.decompressFile(backupPath, decompressedPath)
        sourceFile = decompressedPath
      }

      // Fazer backup do banco atual antes de restaurar
      const currentBackupPath = path.join(this.backupDir, `before_restore_${Date.now()}.db`)
      await this.createDatabaseBackup(currentBackupPath)

      // Restaurar banco
      const dbPath = path.join(process.cwd(), 'data/servicedesk.db')
      fs.copyFileSync(sourceFile, dbPath)

      logger.warn('Database restore completed', { backupPath, currentBackupSaved: currentBackupPath })

      return { success: true }
    } catch (error) {
      logger.error('Database restore failed', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Descomprimir arquivo
   */
  private async decompressFile(inputPath: string, outputPath: string): Promise<void> {
    const { createGunzip } = require('zlib')
    const gunzip = createGunzip()
    const source = fs.createReadStream(inputPath)
    const destination = fs.createWriteStream(outputPath)

    await pipeline(source, gunzip, destination)
  }

  /**
   * Listar backups disponíveis
   */
  listBackups(): { [key: string]: any[] } {
    const backups: { [key: string]: any[] } = {}

    for (const type of ['daily', 'weekly', 'monthly']) {
      const typeDir = path.join(this.backupDir, type)
      backups[type] = []

      if (fs.existsSync(typeDir)) {
        const files = fs.readdirSync(typeDir)
          .filter(file => file.endsWith('.db') || file.endsWith('.db.gz'))
          .map(filename => {
            const filepath = path.join(typeDir, filename)
            const stats = fs.statSync(filepath)
            return {
              filename,
              path: filepath,
              size: stats.size,
              created: stats.mtime,
              compressed: filename.endsWith('.gz')
            }
          })
          .sort((a, b) => b.created.getTime() - a.created.getTime())

        backups[type] = files
      }
    }

    return backups
  }

  /**
   * Obter estatísticas de backup
   */
  getBackupStats(): {
    totalBackups: number
    totalSize: number
    lastBackup?: Date
    nextBackup?: Date
    isRunning: boolean
  } {
    const backups = this.listBackups()
    let totalBackups = 0
    let totalSize = 0
    let lastBackup: Date | undefined

    for (const typeBackups of Object.values(backups)) {
      totalBackups += typeBackups.length
      totalSize += typeBackups.reduce((sum, backup) => sum + backup.size, 0)

      if (typeBackups.length > 0) {
        const latest = typeBackups[0].created
        if (!lastBackup || latest > lastBackup) {
          lastBackup = latest
        }
      }
    }

    return {
      totalBackups,
      totalSize,
      lastBackup,
      isRunning: this.isRunning
    }
  }

  /**
   * Verificar integridade de backup
   */
  async verifyBackup(backupPath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Verificar se o arquivo existe
      if (!fs.existsSync(backupPath)) {
        return { valid: false, error: 'Backup file not found' }
      }

      // Tentar abrir o banco de dados
      const Database = require('better-sqlite3')
      const testDb = new Database(backupPath, { readonly: true })

      // Executar um SELECT simples para verificar integridade
      testDb.prepare('SELECT COUNT(*) FROM sqlite_master').get()
      testDb.close()

      logger.info('Backup verification successful', { backupPath })
      return { valid: true }
    } catch (error) {
      logger.error('Backup verification failed', { backupPath, error })
      return { valid: false, error: error.message }
    }
  }
}

// Instância global do gerenciador de backup
export const backupManager = new BackupManager()

export default backupManager
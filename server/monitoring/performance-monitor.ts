/**
 * Performance Monitoring and Observability Framework
 * 
 * This system provides comprehensive monitoring for the ECOS serverless application:
 * - Request/response performance tracking
 * - Database query performance monitoring
 * - Error rate tracking and alerting
 * - Resource utilization monitoring
 * - Custom metrics collection
 * - Health status reporting
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'count' | 'percent' | 'bytes' | 'rate';
  timestamp: Date;
  tags?: Record<string, string>;
}

interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userAgent?: string;
  responseSize?: number;
  errorMessage?: string;
}

interface DatabaseMetrics {
  query: string;
  duration: number;
  rowsAffected?: number;
  success: boolean;
  timestamp: Date;
  errorMessage?: string;
}

interface SystemMetrics {
  cpuUsage?: number;
  memoryUsage: {
    used: number;
    total: number;
    percent: number;
  };
  uptime: number;
  timestamp: Date;
}

interface AlertConfig {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  enabled: boolean;
  cooldown: number; // minutes
}

interface MonitoringConfig {
  enableRequestTracking: boolean;
  enableDatabaseTracking: boolean;
  enableSystemMetrics: boolean;
  metricsRetentionHours: number;
  alertConfigs: AlertConfig[];
  enableConsoleLogging: boolean;
  enableWebhooks: boolean;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private databaseMetrics: DatabaseMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alertLastFired: Map<string, Date> = new Map();
  private config: MonitoringConfig;
  private metricsCleanupInterval: NodeJS.Timeout | null = null;
  private systemMetricsInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enableRequestTracking: true,
      enableDatabaseTracking: true,
      enableSystemMetrics: true,
      metricsRetentionHours: 24,
      enableConsoleLogging: process.env.NODE_ENV !== 'production',
      enableWebhooks: false,
      alertConfigs: [
        {
          metric: 'request_duration_p95',
          threshold: 2000, // 2 seconds
          operator: 'gt',
          enabled: true,
          cooldown: 10 // 10 minutes
        },
        {
          metric: 'error_rate_5min',
          threshold: 5, // 5%
          operator: 'gt',
          enabled: true,
          cooldown: 5 // 5 minutes
        },
        {
          metric: 'memory_usage_percent',
          threshold: 85, // 85%
          operator: 'gt',
          enabled: true,
          cooldown: 15 // 15 minutes
        }
      ],
      ...config
    };

    this.startBackgroundTasks();
  }

  /**
   * Start background monitoring tasks
   */
  private startBackgroundTasks(): void {
    // Clean up old metrics periodically
    this.metricsCleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Collect system metrics
    if (this.config.enableSystemMetrics) {
      this.systemMetricsInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, 30 * 1000); // Every 30 seconds
    }
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(name: string, value: number, unit: PerformanceMetric['unit'], tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);

    if (this.config.enableConsoleLogging) {
      console.log(`📊 Metric: ${name} = ${value}${unit}`, tags ? `(${JSON.stringify(tags)})` : '');
    }

    this.checkAlerts();
  }

  /**
   * Record request performance metrics
   */
  recordRequest(request: Omit<RequestMetrics, 'timestamp'>): void {
    if (!this.config.enableRequestTracking) return;

    const requestMetric: RequestMetrics = {
      ...request,
      timestamp: new Date()
    };

    this.requestMetrics.push(requestMetric);

    // Record as performance metric
    this.recordMetric('request_duration', request.duration, 'ms', {
      method: request.method,
      path: request.path,
      status: request.statusCode.toString()
    });

    // Record error if status indicates failure
    if (request.statusCode >= 400) {
      this.recordMetric('request_error', 1, 'count', {
        method: request.method,
        path: request.path,
        status: request.statusCode.toString()
      });
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(query: Omit<DatabaseMetrics, 'timestamp'>): void {
    if (!this.config.enableDatabaseTracking) return;

    const dbMetric: DatabaseMetrics = {
      ...query,
      timestamp: new Date()
    };

    this.databaseMetrics.push(dbMetric);

    // Record as performance metric
    this.recordMetric('db_query_duration', query.duration, 'ms', {
      success: query.success.toString(),
      affected_rows: query.rowsAffected?.toString() || '0'
    });

    if (!query.success) {
      this.recordMetric('db_query_error', 1, 'count');
    }
  }

  /**
   * Collect system performance metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const used = Math.round(memUsage.heapUsed / 1024 / 1024);
    const total = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percent = Math.round((used / total) * 100);

    const systemMetric: SystemMetrics = {
      memoryUsage: {
        used,
        total,
        percent
      },
      uptime: process.uptime(),
      timestamp: new Date()
    };

    this.systemMetrics.push(systemMetric);

    // Record as performance metrics
    this.recordMetric('memory_usage_mb', used, 'bytes');
    this.recordMetric('memory_usage_percent', percent, 'percent');
    this.recordMetric('uptime_seconds', systemMetric.uptime, 'count');
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get request performance statistics
   */
  getRequestStats(minutes = 60): {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    statusCodeDistribution: Record<string, number>;
  } {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const recentRequests = this.requestMetrics.filter(r => r.timestamp > cutoff);

    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        statusCodeDistribution: {}
      };
    }

    const durations = recentRequests.map(r => r.duration);
    const errors = recentRequests.filter(r => r.statusCode >= 400).length;
    
    const statusCodes: Record<string, number> = {};
    recentRequests.forEach(r => {
      const status = r.statusCode.toString();
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });

    return {
      totalRequests: recentRequests.length,
      errorRate: (errors / recentRequests.length) * 100,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50ResponseTime: this.calculatePercentile(durations, 50),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      statusCodeDistribution: statusCodes
    };
  }

  /**
   * Get database performance statistics
   */
  getDatabaseStats(minutes = 60): {
    totalQueries: number;
    errorRate: number;
    averageQueryTime: number;
    p95QueryTime: number;
    slowQueries: DatabaseMetrics[];
  } {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const recentQueries = this.databaseMetrics.filter(q => q.timestamp > cutoff);

    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        errorRate: 0,
        averageQueryTime: 0,
        p95QueryTime: 0,
        slowQueries: []
      };
    }

    const durations = recentQueries.map(q => q.duration);
    const errors = recentQueries.filter(q => !q.success).length;
    const slowQueries = recentQueries
      .filter(q => q.duration > 1000) // Queries slower than 1 second
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalQueries: recentQueries.length,
      errorRate: (errors / recentQueries.length) * 100,
      averageQueryTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95QueryTime: this.calculatePercentile(durations, 95),
      slowQueries
    };
  }

  /**
   * Get current system status
   */
  getSystemStatus(): {
    healthy: boolean;
    uptime: number;
    memory: SystemMetrics['memoryUsage'];
    requestStats: ReturnType<typeof this.getRequestStats>;
    databaseStats: ReturnType<typeof this.getDatabaseStats>;
    alertsTriggered: number;
    timestamp: Date;
  } {
    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    const requestStats = this.getRequestStats(60);
    const databaseStats = this.getDatabaseStats(60);

    const healthy = 
      requestStats.errorRate < 10 && // Error rate under 10%
      requestStats.p95ResponseTime < 5000 && // P95 under 5 seconds
      databaseStats.errorRate < 5 && // DB error rate under 5%
      (latest?.memoryUsage.percent || 0) < 90; // Memory under 90%

    return {
      healthy,
      uptime: latest?.uptime || process.uptime(),
      memory: latest?.memoryUsage || { used: 0, total: 0, percent: 0 },
      requestStats,
      databaseStats,
      alertsTriggered: this.alertLastFired.size,
      timestamp: new Date()
    };
  }

  /**
   * Check if any alerts should be triggered
   */
  private checkAlerts(): void {
    const now = new Date();
    
    for (const alertConfig of this.config.alertConfigs) {
      if (!alertConfig.enabled) continue;
      
      const lastFired = this.alertLastFired.get(alertConfig.metric);
      if (lastFired && now.getTime() - lastFired.getTime() < alertConfig.cooldown * 60 * 1000) {
        continue; // Still in cooldown
      }

      let currentValue: number | null = null;

      // Calculate current value based on metric name
      switch (alertConfig.metric) {
        case 'request_duration_p95':
          currentValue = this.getRequestStats(5).p95ResponseTime;
          break;
        case 'error_rate_5min':
          currentValue = this.getRequestStats(5).errorRate;
          break;
        case 'memory_usage_percent':
          const latest = this.systemMetrics[this.systemMetrics.length - 1];
          currentValue = latest?.memoryUsage.percent || 0;
          break;
      }

      if (currentValue !== null && this.shouldTriggerAlert(currentValue, alertConfig)) {
        this.triggerAlert(alertConfig.metric, currentValue, alertConfig.threshold);
        this.alertLastFired.set(alertConfig.metric, now);
      }
    }
  }

  /**
   * Check if alert should be triggered based on configuration
   */
  private shouldTriggerAlert(value: number, config: AlertConfig): boolean {
    switch (config.operator) {
      case 'gt': return value > config.threshold;
      case 'lt': return value < config.threshold;
      case 'eq': return value === config.threshold;
      default: return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(metric: string, currentValue: number, threshold: number): void {
    const alertMessage = `🚨 ALERT: ${metric} = ${currentValue} (threshold: ${threshold})`;
    
    console.error(alertMessage);

    // In production, you could send this to a monitoring service
    // this.sendToMonitoringService(metric, currentValue, threshold);
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.config.metricsRetentionHours * 60 * 60 * 1000);
    
    const initialCounts = {
      metrics: this.metrics.length,
      requests: this.requestMetrics.length,
      database: this.databaseMetrics.length,
      system: this.systemMetrics.length
    };

    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.requestMetrics = this.requestMetrics.filter(r => r.timestamp > cutoff);
    this.databaseMetrics = this.databaseMetrics.filter(d => d.timestamp > cutoff);
    this.systemMetrics = this.systemMetrics.filter(s => s.timestamp > cutoff);

    if (this.config.enableConsoleLogging) {
      const cleaned = {
        metrics: initialCounts.metrics - this.metrics.length,
        requests: initialCounts.requests - this.requestMetrics.length,
        database: initialCounts.database - this.databaseMetrics.length,
        system: initialCounts.system - this.systemMetrics.length
      };

      console.log('🧹 Cleaned up old metrics:', cleaned);
    }
  }

  /**
   * Generate monitoring report
   */
  generateReport(): string {
    const status = this.getSystemStatus();
    
    return `
# ECOS Performance Monitoring Report
Generated: ${status.timestamp.toISOString()}

## System Health: ${status.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}

### System Metrics
- Uptime: ${Math.round(status.uptime / 3600)}h ${Math.round((status.uptime % 3600) / 60)}m
- Memory Usage: ${status.memory.used}MB / ${status.memory.total}MB (${status.memory.percent}%)

### Request Performance (Last 60 minutes)
- Total Requests: ${status.requestStats.totalRequests}
- Error Rate: ${status.requestStats.errorRate.toFixed(2)}%
- Average Response Time: ${status.requestStats.averageResponseTime.toFixed(0)}ms
- P95 Response Time: ${status.requestStats.p95ResponseTime.toFixed(0)}ms
- P99 Response Time: ${status.requestStats.p99ResponseTime.toFixed(0)}ms

### Database Performance (Last 60 minutes)
- Total Queries: ${status.databaseStats.totalQueries}
- Error Rate: ${status.databaseStats.errorRate.toFixed(2)}%
- Average Query Time: ${status.databaseStats.averageQueryTime.toFixed(0)}ms
- P95 Query Time: ${status.databaseStats.p95QueryTime.toFixed(0)}ms
- Slow Queries: ${status.databaseStats.slowQueries.length}

### Alerts
- Active Alerts: ${status.alertsTriggered}

## Status Code Distribution
${Object.entries(status.requestStats.statusCodeDistribution)
  .map(([code, count]) => `- ${code}: ${count}`)
  .join('\n')}
    `.trim();
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
    }
    
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }

    console.log('📊 Performance monitoring shutdown complete');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Graceful shutdown handling
process.on('SIGTERM', () => performanceMonitor.shutdown());
process.on('SIGINT', () => performanceMonitor.shutdown());

export { performanceMonitor, PerformanceMonitor };
export type { PerformanceMetric, RequestMetrics, DatabaseMetrics, MonitoringConfig };
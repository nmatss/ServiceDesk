// Enterprise Resource Optimization Engine
// Provides intelligent recommendations for resource allocation, capacity planning, and cost optimization

import { demandForecastingEngine, DemandForecast, CapacityRecommendation } from './demand-forecasting';
import logger from '../monitoring/structured-logger';

export interface ResourceOptimization {
  optimization_id: string;
  optimization_type: 'staffing' | 'scheduling' | 'skill_allocation' | 'cost_reduction' | 'capacity_planning';
  target_entity: 'agents' | 'departments' | 'queues' | 'system' | 'workflows';
  current_state: ResourceState;
  optimized_state: ResourceState;
  optimization_strategies: OptimizationStrategy[];
  expected_benefits: OptimizationBenefit[];
  implementation_plan: ImplementationPlan;
  risk_assessment: OptimizationRiskAssessment;
  cost_benefit_analysis: CostBenefitAnalysis;
  confidence_score: number;
  generated_at: Date;
  valid_until: Date;
  metadata: Record<string, any>;
}

export interface ResourceState {
  total_agents: number;
  available_agents: number;
  active_agents: number;
  agent_utilization: number; // 0-1
  queue_lengths: Record<string, number>;
  average_wait_time: number;
  service_level: number; // 0-1
  cost_per_hour: number;
  workload_distribution: WorkloadDistribution[];
  skill_coverage: SkillCoverage[];
  capacity_metrics: CapacityMetrics;
}

export interface WorkloadDistribution {
  agent_id: string;
  current_tickets: number;
  capacity: number;
  utilization: number;
  efficiency_score: number;
  skill_match_score: number;
}

export interface SkillCoverage {
  skill_name: string;
  required_coverage: number;
  current_coverage: number;
  gap: number;
  agents_with_skill: string[];
}

export interface CapacityMetrics {
  total_capacity: number;
  used_capacity: number;
  available_capacity: number;
  peak_capacity_usage: number;
  capacity_buffer: number;
}

export interface OptimizationStrategy {
  strategy_id: string;
  strategy_name: string;
  strategy_type: 'reallocate' | 'schedule_change' | 'skill_development' | 'automation' | 'process_improvement';
  description: string;
  target_metrics: string[];
  expected_improvement: Record<string, number>;
  effort_required: 'low' | 'medium' | 'high';
  time_to_implement: string;
  resources_required: string[];
  prerequisites: string[];
  success_probability: number;
  action_items: OptimizationAction[];
}

export interface OptimizationAction {
  action_id: string;
  action_type: 'immediate' | 'short_term' | 'long_term';
  description: string;
  responsible_role: string;
  estimated_duration: string;
  dependencies: string[];
  success_criteria: string[];
}

export interface OptimizationBenefit {
  benefit_type: 'cost_saving' | 'efficiency_gain' | 'quality_improvement' | 'risk_reduction';
  metric_name: string;
  current_value: number;
  target_value: number;
  improvement_percentage: number;
  annual_value: number;
  confidence: number;
  realization_timeframe: string;
}

export interface ImplementationPlan {
  phases: ImplementationPhase[];
  total_duration: string;
  critical_path: string[];
  resource_requirements: ResourceRequirement[];
  milestones: Milestone[];
  rollback_plan: string;
}

export interface ImplementationPhase {
  phase_name: string;
  phase_order: number;
  duration: string;
  description: string;
  deliverables: string[];
  success_criteria: string[];
  dependencies: string[];
  risks: string[];
}

export interface ResourceRequirement {
  resource_type: 'human' | 'financial' | 'technical' | 'time';
  description: string;
  quantity: number;
  unit: string;
  cost: number;
  availability: 'available' | 'limited' | 'needs_approval';
}

export interface Milestone {
  milestone_name: string;
  target_date: Date;
  description: string;
  success_criteria: string[];
  deliverables: string[];
}

export interface OptimizationRiskAssessment {
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: OptimizationRisk[];
  mitigation_strategies: RiskMitigation[];
  contingency_plans: ContingencyPlan[];
}

export interface OptimizationRisk {
  risk_id: string;
  risk_type: 'implementation' | 'adoption' | 'technical' | 'business';
  description: string;
  probability: number;
  impact: number;
  risk_score: number;
  mitigation_actions: string[];
}

export interface RiskMitigation {
  risk_id: string;
  mitigation_strategy: string;
  effectiveness: number;
  cost: number;
  implementation_effort: string;
}

export interface ContingencyPlan {
  trigger_condition: string;
  response_actions: string[];
  responsible_team: string;
  estimated_cost: number;
}

export interface CostBenefitAnalysis {
  implementation_costs: CostCategory[];
  operational_costs: CostCategory[];
  benefits: BenefitCategory[];
  net_present_value: number;
  return_on_investment: number;
  payback_period_months: number;
  break_even_point: Date;
}

export interface CostCategory {
  category: string;
  description: string;
  amount: number;
  frequency: 'one_time' | 'monthly' | 'annual';
  confidence: number;
}

export interface BenefitCategory {
  category: string;
  description: string;
  amount: number;
  frequency: 'monthly' | 'annual';
  confidence: number;
  realization_timeline: string;
}

export interface ScheduleOptimization {
  schedule_id: string;
  agent_id: string;
  agent_name: string;
  current_schedule: ScheduleSlot[];
  optimized_schedule: ScheduleSlot[];
  optimization_reasons: string[];
  impact_metrics: ScheduleImpactMetrics;
}

export interface ScheduleSlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  assignment_type: 'tickets' | 'training' | 'admin' | 'break' | 'meeting';
  skill_requirements: string[];
  workload_prediction: number;
}

export interface ScheduleImpactMetrics {
  service_level_improvement: number;
  cost_impact: number;
  agent_satisfaction_impact: number;
  coverage_improvement: number;
  workload_balance_improvement: number;
}

export class ResourceOptimizerEngine {
  private optimizationHistory: Map<string, ResourceOptimization[]> = new Map();

  constructor() {
    // Configuration settings are loaded on-demand
  }

  // ========================================
  // MAIN OPTIMIZATION METHODS
  // ========================================

  async optimizeStaffing(
    targetServiceLevel: number = 0.8,
    forecastHorizon: number = 7, // days
    includeScheduling: boolean = true
  ): Promise<ResourceOptimization> {
    logger.info('[Resource Optimizer] Starting staffing optimization');

    try {
      // Get current resource state
      const currentState = await this.getCurrentResourceState();

      // Get demand forecast
      const demandForecast = await demandForecastingEngine.generateDemandForecast(
        'workload',
        'hourly',
        forecastHorizon * 24
      );

      // Analyze current performance gaps
      const performanceGaps = await this.analyzePerformanceGaps(currentState, targetServiceLevel);

      // Generate staffing strategies
      const staffingStrategies = await this.generateStaffingStrategies(
        currentState,
        demandForecast,
        targetServiceLevel,
        performanceGaps
      );

      // Calculate optimized state
      const optimizedState = await this.calculateOptimizedState(
        currentState,
        staffingStrategies,
        demandForecast
      );

      // Generate implementation plan
      const implementationPlan = await this.generateImplementationPlan(
        staffingStrategies,
        'staffing'
      );

      // Assess risks
      const riskAssessment = await this.assessOptimizationRisks(
        staffingStrategies,
        currentState,
        optimizedState
      );

      // Perform cost-benefit analysis
      const costBenefitAnalysis = await this.performCostBenefitAnalysis(
        currentState,
        optimizedState,
        implementationPlan
      );

      // Calculate expected benefits
      const expectedBenefits = this.calculateExpectedBenefits(
        currentState,
        optimizedState
      );

      const optimization: ResourceOptimization = {
        optimization_id: `staffing_${Date.now()}`,
        optimization_type: 'staffing',
        target_entity: 'agents',
        current_state: currentState,
        optimized_state: optimizedState,
        optimization_strategies: staffingStrategies,
        expected_benefits: expectedBenefits,
        implementation_plan: implementationPlan,
        risk_assessment: riskAssessment,
        cost_benefit_analysis: costBenefitAnalysis,
        confidence_score: this.calculateOptimizationConfidence(staffingStrategies, riskAssessment),
        generated_at: new Date(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: {
          target_service_level: targetServiceLevel,
          forecast_horizon: forecastHorizon,
          include_scheduling: includeScheduling
        }
      };

      this.storeOptimizationResult(optimization);

      logger.info('[Resource Optimizer] Staffing optimization completed');
      return optimization;

    } catch (error) {
      logger.error('[Resource Optimizer] Error during staffing optimization', error);
      throw error;
    }
  }

  async optimizeScheduling(
    agentIds?: string[],
    optimizationPeriod: number = 14 // days
  ): Promise<ScheduleOptimization[]> {
    logger.info('[Resource Optimizer] Starting schedule optimization');

    const agents = agentIds || await this.getAllActiveAgentIds();
    const scheduleOptimizations: ScheduleOptimization[] = [];

    // Get demand patterns
    const demandForecast = await demandForecastingEngine.generateDemandForecast(
      'workload',
      'hourly',
      optimizationPeriod * 24
    );

    for (const agentId of agents) {
      const agentData = await this.getAgentData(agentId);
      const currentSchedule = await this.getCurrentSchedule(agentId);
      const agentSkills = await this.getAgentSkills(agentId);

      // Analyze workload patterns for this agent
      const workloadPattern = this.analyzeAgentWorkloadPattern(
        agentId,
        demandForecast.predictions
      );

      // Generate optimized schedule
      const optimizedSchedule = await this.generateOptimizedSchedule(
        agentId,
        currentSchedule,
        workloadPattern,
        agentSkills,
        demandForecast
      );

      // Calculate impact metrics
      const impactMetrics = await this.calculateScheduleImpact(
        currentSchedule,
        optimizedSchedule,
        workloadPattern
      );

      // Generate optimization reasons
      const optimizationReasons = this.generateOptimizationReasons(
        currentSchedule,
        optimizedSchedule,
        workloadPattern
      );

      scheduleOptimizations.push({
        schedule_id: `schedule_${agentId}_${Date.now()}`,
        agent_id: agentId,
        agent_name: agentData.name,
        current_schedule: currentSchedule,
        optimized_schedule: optimizedSchedule,
        optimization_reasons: optimizationReasons,
        impact_metrics: impactMetrics
      });
    }

    logger.info(`[Resource Optimizer] Schedule optimization completed for ${scheduleOptimizations.length} agents`);
    return scheduleOptimizations;
  }

  async optimizeSkillAllocation(): Promise<ResourceOptimization> {
    logger.info('[Resource Optimizer] Starting skill allocation optimization');

    const currentState = await this.getCurrentResourceState();
    const skillGaps = await this.analyzeSkillGaps();
    const workloadBySkill = await this.analyzeWorkloadBySkill();

    const strategies = await this.generateSkillAllocationStrategies(
      skillGaps,
      workloadBySkill,
      currentState
    );

    const optimizedState = await this.calculateSkillOptimizedState(
      currentState,
      strategies
    );

    const optimization: ResourceOptimization = {
      optimization_id: `skill_allocation_${Date.now()}`,
      optimization_type: 'skill_allocation',
      target_entity: 'agents',
      current_state: currentState,
      optimized_state: optimizedState,
      optimization_strategies: strategies,
      expected_benefits: this.calculateExpectedBenefits(currentState, optimizedState),
      implementation_plan: await this.generateImplementationPlan(strategies, 'skill_allocation'),
      risk_assessment: await this.assessOptimizationRisks(strategies, currentState, optimizedState),
      cost_benefit_analysis: await this.performCostBenefitAnalysis(currentState, optimizedState, {} as any),
      confidence_score: 0.8,
      generated_at: new Date(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        skill_gaps_analyzed: skillGaps.length,
        strategies_generated: strategies.length
      }
    };

    this.storeOptimizationResult(optimization);
    return optimization;
  }

  async optimizeCosts(
    targetCostReduction: number = 0.15 // 15%
  ): Promise<ResourceOptimization> {
    logger.info('[Resource Optimizer] Starting cost optimization');

    const currentState = await this.getCurrentResourceState();
    const costAnalysis = await this.analyzeCostStructure();
    const efficiencyOpportunities = await this.identifyEfficiencyOpportunities();

    const strategies = await this.generateCostOptimizationStrategies(
      costAnalysis,
      efficiencyOpportunities,
      targetCostReduction
    );

    const optimizedState = await this.calculateCostOptimizedState(
      currentState,
      strategies
    );

    const optimization: ResourceOptimization = {
      optimization_id: `cost_optimization_${Date.now()}`,
      optimization_type: 'cost_reduction',
      target_entity: 'system',
      current_state: currentState,
      optimized_state: optimizedState,
      optimization_strategies: strategies,
      expected_benefits: this.calculateExpectedBenefits(currentState, optimizedState),
      implementation_plan: await this.generateImplementationPlan(strategies, 'cost_reduction'),
      risk_assessment: await this.assessOptimizationRisks(strategies, currentState, optimizedState),
      cost_benefit_analysis: await this.performCostBenefitAnalysis(currentState, optimizedState, {} as any),
      confidence_score: 0.75,
      generated_at: new Date(),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        target_cost_reduction: targetCostReduction,
        opportunities_identified: efficiencyOpportunities.length
      }
    };

    this.storeOptimizationResult(optimization);
    return optimization;
  }

  // ========================================
  // CAPACITY PLANNING
  // ========================================

  async generateCapacityPlan(
    planningHorizon: number = 90, // days
    growthScenarios: GrowthScenario[] = []
  ): Promise<CapacityPlan> {
    logger.info('[Resource Optimizer] Generating capacity plan');

    // Get demand forecasts for different scenarios
    const baseForecast = await demandForecastingEngine.generateDemandForecast(
      'workload',
      'daily',
      planningHorizon
    );

    const capacityRecommendations = await demandForecastingEngine.generateCapacityRecommendations(
      planningHorizon,
      0.8 // 80% service level target
    );

    // Analyze different growth scenarios
    const scenarioAnalysis = await this.analyzeGrowthScenarios(
      baseForecast,
      growthScenarios,
      planningHorizon
    );

    // Calculate capacity requirements
    const capacityRequirements = this.calculateCapacityRequirements(
      capacityRecommendations,
      scenarioAnalysis
    );

    // Generate hiring and training plans
    const hiringPlan = await this.generateHiringPlan(capacityRequirements);
    const trainingPlan = await this.generateTrainingPlan(capacityRequirements);

    return {
      plan_id: `capacity_plan_${Date.now()}`,
      planning_horizon_days: planningHorizon,
      base_forecast: baseForecast,
      scenario_analysis: scenarioAnalysis,
      capacity_requirements: capacityRequirements,
      hiring_plan: hiringPlan,
      training_plan: trainingPlan,
      investment_requirements: this.calculateInvestmentRequirements(hiringPlan, trainingPlan),
      risk_assessment: await this.assessCapacityPlanRisks(capacityRequirements, scenarioAnalysis),
      generated_at: new Date(),
      last_updated: new Date()
    };
  }

  // ========================================
  // ANALYSIS METHODS
  // ========================================

  private async analyzePerformanceGaps(
    currentState: ResourceState,
    targetServiceLevel: number
  ): Promise<PerformanceGap[]> {
    const gaps: PerformanceGap[] = [];

    // Service level gap
    if (currentState.service_level < targetServiceLevel) {
      gaps.push({
        metric: 'service_level',
        current_value: currentState.service_level,
        target_value: targetServiceLevel,
        gap_percentage: (targetServiceLevel - currentState.service_level) / targetServiceLevel,
        impact_severity: 'high',
        recommended_actions: ['Increase staffing', 'Optimize scheduling', 'Improve processes']
      });
    }

    // Utilization gap
    const optimalUtilization = 0.85;
    if (Math.abs(currentState.agent_utilization - optimalUtilization) > 0.1) {
      gaps.push({
        metric: 'utilization',
        current_value: currentState.agent_utilization,
        target_value: optimalUtilization,
        gap_percentage: Math.abs(currentState.agent_utilization - optimalUtilization) / optimalUtilization,
        impact_severity: currentState.agent_utilization > optimalUtilization ? 'high' : 'medium',
        recommended_actions: currentState.agent_utilization > optimalUtilization
          ? ['Add resources', 'Redistribute workload']
          : ['Optimize assignments', 'Cross-train agents']
      });
    }

    // Queue length gaps
    for (const [queueName, length] of Object.entries(currentState.queue_lengths)) {
      if (length > 10) { // Threshold
        gaps.push({
          metric: `queue_${queueName}`,
          current_value: length,
          target_value: 5,
          gap_percentage: (length - 5) / 5,
          impact_severity: length > 20 ? 'critical' : 'high',
          recommended_actions: ['Increase queue capacity', 'Improve routing', 'Add specialized agents']
        });
      }
    }

    return gaps;
  }

  private async generateStaffingStrategies(
    currentState: ResourceState,
    forecast: DemandForecast,
    targetServiceLevel: number,
    gaps: PerformanceGap[]
  ): Promise<OptimizationStrategy[]> {
    const strategies: OptimizationStrategy[] = [];

    // Strategy 1: Staffing level adjustment
    const staffingGap = this.calculateStaffingGap(currentState, forecast, targetServiceLevel);
    if (Math.abs(staffingGap) > 0.5) {
      strategies.push({
        strategy_id: 'staffing_adjustment',
        strategy_name: staffingGap > 0 ? 'Increase Staffing Levels' : 'Optimize Current Staffing',
        strategy_type: 'reallocate',
        description: `${staffingGap > 0 ? 'Add' : 'Redistribute'} ${Math.abs(staffingGap).toFixed(1)} FTE agents`,
        target_metrics: ['service_level', 'agent_utilization', 'average_wait_time'],
        expected_improvement: {
          service_level: Math.min(0.15, Math.abs(staffingGap) * 0.05),
          agent_utilization: staffingGap > 0 ? -0.1 : 0.05,
          average_wait_time: -0.2
        },
        effort_required: staffingGap > 0 ? 'high' : 'medium',
        time_to_implement: staffingGap > 0 ? '4-8 weeks' : '1-2 weeks',
        resources_required: staffingGap > 0 ? ['Budget approval', 'Recruitment'] : ['Management approval'],
        prerequisites: staffingGap > 0 ? ['Budget allocation', 'Job descriptions'] : ['Workload analysis'],
        success_probability: 0.85,
        action_items: this.generateStaffingActionItems(staffingGap)
      });
    }

    // Strategy 2: Schedule optimization
    if (gaps.some(g => g.metric === 'service_level')) {
      strategies.push({
        strategy_id: 'schedule_optimization',
        strategy_name: 'Optimize Agent Schedules',
        strategy_type: 'schedule_change',
        description: 'Realign agent schedules with demand patterns',
        target_metrics: ['service_level', 'coverage_efficiency'],
        expected_improvement: {
          service_level: 0.08,
          coverage_efficiency: 0.12
        },
        effort_required: 'medium',
        time_to_implement: '2-3 weeks',
        resources_required: ['Schedule planning tools', 'Agent coordination'],
        prerequisites: ['Demand pattern analysis', 'Agent preference survey'],
        success_probability: 0.9,
        action_items: this.generateScheduleActionItems()
      });
    }

    // Strategy 3: Skill-based routing optimization
    const skillGaps = await this.analyzeSkillGaps();
    if (skillGaps.length > 0) {
      strategies.push({
        strategy_id: 'skill_routing_optimization',
        strategy_name: 'Optimize Skill-Based Routing',
        strategy_type: 'process_improvement',
        description: 'Improve ticket routing based on agent skills and workload',
        target_metrics: ['first_call_resolution', 'average_handle_time'],
        expected_improvement: {
          first_call_resolution: 0.15,
          average_handle_time: -0.1
        },
        effort_required: 'medium',
        time_to_implement: '3-4 weeks',
        resources_required: ['Routing algorithm updates', 'Agent training'],
        prerequisites: ['Skill matrix update', 'Routing rules review'],
        success_probability: 0.8,
        action_items: this.generateSkillRoutingActionItems()
      });
    }

    return strategies;
  }

  // ========================================
  // COST-BENEFIT ANALYSIS
  // ========================================

  private async performCostBenefitAnalysis(
    currentState: ResourceState,
    optimizedState: ResourceState,
    _implementationPlan: ImplementationPlan
  ): Promise<CostBenefitAnalysis> {
    // Calculate implementation costs
    const implementationCosts: CostCategory[] = [
      {
        category: 'Personnel',
        description: 'Hiring and onboarding costs',
        amount: Math.max(0, optimizedState.total_agents - currentState.total_agents) * 5000,
        frequency: 'one_time',
        confidence: 0.8
      },
      {
        category: 'Training',
        description: 'Training and development costs',
        amount: optimizedState.total_agents * 1000,
        frequency: 'one_time',
        confidence: 0.9
      },
      {
        category: 'Technology',
        description: 'System updates and tools',
        amount: 15000,
        frequency: 'one_time',
        confidence: 0.7
      }
    ];

    // Calculate operational costs
    const operationalCosts: CostCategory[] = [
      {
        category: 'Salaries',
        description: 'Ongoing salary costs',
        amount: (optimizedState.total_agents - currentState.total_agents) * 4000,
        frequency: 'monthly',
        confidence: 0.95
      },
      {
        category: 'Benefits',
        description: 'Benefits and overhead',
        amount: (optimizedState.total_agents - currentState.total_agents) * 1200,
        frequency: 'monthly',
        confidence: 0.9
      }
    ];

    // Calculate benefits
    const benefits: BenefitCategory[] = [
      {
        category: 'Service Level Improvement',
        description: 'Revenue from improved customer satisfaction',
        amount: (optimizedState.service_level - currentState.service_level) * 100000,
        frequency: 'annual',
        confidence: 0.7,
        realization_timeline: '3-6 months'
      },
      {
        category: 'Efficiency Gains',
        description: 'Cost savings from improved efficiency',
        amount: (currentState.agent_utilization < 0.8 ? 50000 : 0),
        frequency: 'annual',
        confidence: 0.8,
        realization_timeline: '2-4 months'
      },
      {
        category: 'Reduced Escalations',
        description: 'Cost savings from fewer escalations',
        amount: 25000,
        frequency: 'annual',
        confidence: 0.75,
        realization_timeline: '4-8 months'
      }
    ];

    // Calculate financial metrics
    const totalImplementationCost = implementationCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const annualOperationalCost = operationalCosts
      .filter(cost => cost.frequency === 'monthly')
      .reduce((sum, cost) => sum + cost.amount * 12, 0);
    const annualBenefits = benefits.reduce((sum, benefit) => sum + benefit.amount, 0);

    const netAnnualBenefit = annualBenefits - annualOperationalCost;
    const paybackPeriodMonths = netAnnualBenefit > 0 ? (totalImplementationCost / netAnnualBenefit) * 12 : 999;
    const roi = netAnnualBenefit > 0 ? ((netAnnualBenefit - totalImplementationCost) / totalImplementationCost) * 100 : -100;

    // Calculate NPV (simplified)
    const discountRate = 0.1;
    const npv = this.calculateNPV(totalImplementationCost, netAnnualBenefit, 3, discountRate);

    return {
      implementation_costs: implementationCosts,
      operational_costs: operationalCosts,
      benefits: benefits,
      net_present_value: npv,
      return_on_investment: roi,
      payback_period_months: Math.round(paybackPeriodMonths),
      break_even_point: new Date(Date.now() + paybackPeriodMonths * 30 * 24 * 60 * 60 * 1000)
    };
  }

  private calculateNPV(
    initialInvestment: number,
    annualCashFlow: number,
    years: number,
    discountRate: number
  ): number {
    let npv = -initialInvestment;

    for (let year = 1; year <= years; year++) {
      npv += annualCashFlow / Math.pow(1 + discountRate, year);
    }

    return npv;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private calculateOptimizationConfidence(
    strategies: OptimizationStrategy[],
    riskAssessment: OptimizationRiskAssessment
  ): number {
    const strategyConfidence = strategies.reduce((sum, s) => sum + s.success_probability, 0) / strategies.length;
    const riskPenalty = riskAssessment.overall_risk_level === 'high' ? 0.2 :
                        riskAssessment.overall_risk_level === 'medium' ? 0.1 : 0;

    return Math.max(0.5, strategyConfidence - riskPenalty);
  }

  private calculateExpectedBenefits(
    currentState: ResourceState,
    optimizedState: ResourceState
  ): OptimizationBenefit[] {
    const benefits: OptimizationBenefit[] = [];

    // Service level improvement
    if (optimizedState.service_level > currentState.service_level) {
      benefits.push({
        benefit_type: 'quality_improvement',
        metric_name: 'Service Level',
        current_value: currentState.service_level,
        target_value: optimizedState.service_level,
        improvement_percentage: ((optimizedState.service_level - currentState.service_level) / currentState.service_level) * 100,
        annual_value: 75000,
        confidence: 0.8,
        realization_timeframe: '3-6 months'
      });
    }

    // Cost efficiency
    if (optimizedState.cost_per_hour < currentState.cost_per_hour) {
      benefits.push({
        benefit_type: 'cost_saving',
        metric_name: 'Cost per Hour',
        current_value: currentState.cost_per_hour,
        target_value: optimizedState.cost_per_hour,
        improvement_percentage: ((currentState.cost_per_hour - optimizedState.cost_per_hour) / currentState.cost_per_hour) * 100,
        annual_value: (currentState.cost_per_hour - optimizedState.cost_per_hour) * 8760, // Annual hours
        confidence: 0.85,
        realization_timeframe: '1-3 months'
      });
    }

    // Utilization improvement
    const utilizationDiff = Math.abs(optimizedState.agent_utilization - 0.8) - Math.abs(currentState.agent_utilization - 0.8);
    if (utilizationDiff < 0) { // Better utilization (closer to optimal)
      benefits.push({
        benefit_type: 'efficiency_gain',
        metric_name: 'Agent Utilization',
        current_value: currentState.agent_utilization,
        target_value: optimizedState.agent_utilization,
        improvement_percentage: Math.abs(utilizationDiff) * 100,
        annual_value: 50000,
        confidence: 0.75,
        realization_timeframe: '2-4 months'
      });
    }

    return benefits;
  }

  private storeOptimizationResult(optimization: ResourceOptimization): void {
    const key = optimization.optimization_type;

    if (!this.optimizationHistory.has(key)) {
      this.optimizationHistory.set(key, []);
    }

    const history = this.optimizationHistory.get(key)!;
    history.push(optimization);

    // Keep only last 50 optimizations
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  // Mock implementations for data access and calculations
  private async getCurrentResourceState(): Promise<ResourceState> {
    // Mock implementation
    return {
      total_agents: 25,
      available_agents: 22,
      active_agents: 20,
      agent_utilization: 0.75,
      queue_lengths: { 'general': 8, 'technical': 12, 'billing': 5 },
      average_wait_time: 3.5,
      service_level: 0.72,
      cost_per_hour: 45,
      workload_distribution: [],
      skill_coverage: [],
      capacity_metrics: {
        total_capacity: 100,
        used_capacity: 75,
        available_capacity: 25,
        peak_capacity_usage: 90,
        capacity_buffer: 10
      }
    };
  }

  // Additional helper methods (simplified implementations)
  private calculateStaffingGap(_state: ResourceState, _forecast: DemandForecast, _target: number): number { return 2.5; }
  private generateStaffingActionItems(_gap: number): OptimizationAction[] { return []; }
  private generateScheduleActionItems(): OptimizationAction[] { return []; }
  private generateSkillRoutingActionItems(): OptimizationAction[] { return []; }
  private async analyzeSkillGaps(): Promise<SkillGap[]> { return []; }
  private async analyzeWorkloadBySkill(): Promise<WorkloadBySkill[]> { return []; }
  private async generateSkillAllocationStrategies(_gaps: SkillGap[], _workload: WorkloadBySkill[], _state: ResourceState): Promise<OptimizationStrategy[]> { return []; }
  private async calculateSkillOptimizedState(current: ResourceState, _strategies: OptimizationStrategy[]): Promise<ResourceState> { return current; }
  private async analyzeCostStructure(): Promise<CostStructure> { return {} as CostStructure; }
  private async identifyEfficiencyOpportunities(): Promise<EfficiencyOpportunity[]> { return []; }
  private async generateCostOptimizationStrategies(_cost: CostStructure, _efficiency: EfficiencyOpportunity[], _target: number): Promise<OptimizationStrategy[]> { return []; }
  private async calculateCostOptimizedState(current: ResourceState, _strategies: OptimizationStrategy[]): Promise<ResourceState> { return current; }
  private async calculateOptimizedState(current: ResourceState, _strategies: OptimizationStrategy[], _forecast: DemandForecast): Promise<ResourceState> { return current; }
  private async generateImplementationPlan(_strategies: OptimizationStrategy[], _type: string): Promise<ImplementationPlan> {
    return {
      phases: [],
      total_duration: '4-6 weeks',
      critical_path: [],
      resource_requirements: [],
      milestones: [],
      rollback_plan: 'Revert to previous configuration'
    };
  }
  private async assessOptimizationRisks(_strategies: OptimizationStrategy[], _current: ResourceState, _optimized: ResourceState): Promise<OptimizationRiskAssessment> {
    return {
      overall_risk_level: 'medium',
      risk_factors: [],
      mitigation_strategies: [],
      contingency_plans: []
    };
  }

  // Additional data access methods
  private async getAllActiveAgentIds(): Promise<string[]> { return ['agent1', 'agent2', 'agent3']; }
  private async getAgentData(_agentId: string): Promise<{ name: string }> { return { name: 'Agent Name' }; }
  private async getCurrentSchedule(_agentId: string): Promise<ScheduleSlot[]> { return []; }
  private async getAgentSkills(_agentId: string): Promise<string[]> { return []; }
  private analyzeAgentWorkloadPattern(_agentId: string, _predictions: DemandForecast['predictions']): WorkloadPattern { return {} as WorkloadPattern; }
  private async generateOptimizedSchedule(_agentId: string, _current: ScheduleSlot[], _pattern: WorkloadPattern, _skills: string[], _forecast: DemandForecast): Promise<ScheduleSlot[]> { return []; }
  private async calculateScheduleImpact(_current: ScheduleSlot[], _optimized: ScheduleSlot[], _pattern: WorkloadPattern): Promise<ScheduleImpactMetrics> {
    return {
      service_level_improvement: 0.05,
      cost_impact: -200,
      agent_satisfaction_impact: 0.1,
      coverage_improvement: 0.08,
      workload_balance_improvement: 0.12
    };
  }
  private generateOptimizationReasons(_current: ScheduleSlot[], _optimized: ScheduleSlot[], _pattern: WorkloadPattern): string[] { return []; }

  // Capacity planning methods
  private async analyzeGrowthScenarios(_forecast: DemandForecast, _scenarios: GrowthScenario[], _horizon: number): Promise<ScenarioAnalysis[]> { return []; }
  private calculateCapacityRequirements(_recommendations: CapacityRecommendation[], _analysis: ScenarioAnalysis[]): CapacityRequirement[] { return []; }
  private async generateHiringPlan(_requirements: CapacityRequirement[]): Promise<HiringPlan> { return {} as HiringPlan; }
  private async generateTrainingPlan(_requirements: CapacityRequirement[]): Promise<TrainingPlan> { return {} as TrainingPlan; }
  private calculateInvestmentRequirements(_hiring: HiringPlan, _training: TrainingPlan): InvestmentRequirement[] { return []; }
  private async assessCapacityPlanRisks(_requirements: CapacityRequirement[], _analysis: ScenarioAnalysis[]): Promise<OptimizationRiskAssessment> {
    return {
      overall_risk_level: 'medium',
      risk_factors: [],
      mitigation_strategies: [],
      contingency_plans: []
    };
  }
}

// ========================================
// SUPPORTING INTERFACES
// ========================================

interface PerformanceGap {
  metric: string;
  current_value: number;
  target_value: number;
  gap_percentage: number;
  impact_severity: 'low' | 'medium' | 'high' | 'critical';
  recommended_actions: string[];
}

interface SkillGap {
  skill_name: string;
  required_level: number;
  current_level: number;
  agents_needing_training: string[];
}

interface WorkloadBySkill {
  skill_name: string;
  total_workload: number;
  available_capacity: number;
  utilization: number;
}

interface CostStructure {
  labor_costs: number;
  technology_costs: number;
  overhead_costs: number;
  total_costs: number;
}

interface EfficiencyOpportunity {
  opportunity_name: string;
  potential_savings: number;
  implementation_effort: string;
  risk_level: string;
}

interface WorkloadPattern {
  hourly_distribution: number[];
  peak_hours: number[];
  seasonal_patterns: any[];
}

interface GrowthScenario {
  scenario_name: string;
  growth_rate: number;
  duration_months: number;
  assumptions: string[];
}

interface ScenarioAnalysis {
  scenario: GrowthScenario;
  capacity_impact: number;
  cost_impact: number;
  timeline: string;
}

interface CapacityRequirement {
  period: string;
  required_capacity: number;
  skill_requirements: Record<string, number>;
  confidence: number;
}

interface CapacityPlan {
  plan_id: string;
  planning_horizon_days: number;
  base_forecast: DemandForecast;
  scenario_analysis: ScenarioAnalysis[];
  capacity_requirements: CapacityRequirement[];
  hiring_plan: HiringPlan;
  training_plan: TrainingPlan;
  investment_requirements: InvestmentRequirement[];
  risk_assessment: OptimizationRiskAssessment;
  generated_at: Date;
  last_updated: Date;
}

interface HiringPlan {
  total_positions: number;
  positions_by_skill: Record<string, number>;
  timeline: string;
  estimated_cost: number;
}

interface TrainingPlan {
  training_programs: TrainingProgram[];
  total_duration: string;
  estimated_cost: number;
}

interface TrainingProgram {
  program_name: string;
  target_skills: string[];
  duration: string;
  cost_per_person: number;
  capacity: number;
}

interface InvestmentRequirement {
  category: string;
  amount: number;
  timing: string;
  risk_level: string;
}

// Export singleton instance
export const resourceOptimizerEngine = new ResourceOptimizerEngine();
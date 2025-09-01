const Job = require('../models/Job');
const Application = require('../models/Application');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get analytics dashboard data
// @route   GET /api/analytics
// @access  Private
exports.getAnalytics = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get date range from query params (default: 30 days)
  const { range = '30d' } = req.query;
  let startDate = new Date();
  
  switch (range) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'ytd':
      startDate = new Date(new Date().getFullYear(), 0, 1);
      break;
    case 'all':
      startDate = new Date(0); // Unix epoch
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Get applications for the user with populated job data
  const applications = await Application.find({
    user: userId,
    createdAt: { $gte: startDate }
  }).populate('job', 'title company location salary');

  // Get jobs for the user to calculate additional metrics
  const jobs = await Job.find({ 
    postedBy: userId,
    createdAt: { $gte: startDate }
  });

  // Calculate metrics
  const totalApplications = applications.length;
  const interviewCount = applications.filter(app => app.status === 'interviewing').length;
  const offerCount = applications.filter(app => app.status === 'offer').length;
  const rejectedCount = applications.filter(app => app.status === 'rejected').length;
  
  const interviewRate = totalApplications > 0 ? Math.round((interviewCount / totalApplications) * 100) : 0;
  const offerRate = totalApplications > 0 ? Math.round((offerCount / totalApplications) * 100) : 0;

  // Calculate average response time
  const respondedApplications = applications.filter(app => app.responseDate && app.appliedDate);
  let averageResponseTime = 0;
  
  if (respondedApplications.length > 0) {
    const totalResponseTime = respondedApplications.reduce((total, app) => {
      const responseTime = (app.responseDate - app.appliedDate) / (1000 * 60 * 60 * 24); // Days
      return total + responseTime;
    }, 0);
    
    averageResponseTime = (totalResponseTime / respondedApplications.length).toFixed(1);
  }

  // Calculate average salary from jobs with salary data
  const jobsWithSalary = jobs.filter(job => job.salary && typeof job.salary === 'string' && job.salary.includes('$'));
  let averageSalary = 0;
  
  if (jobsWithSalary.length > 0) {
    const salaryNumbers = jobsWithSalary.map(job => {
      // Extract numbers from salary strings like "$120,000 - $150,000"
      const numbers = job.salary.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        return (parseInt(numbers[0]) + parseInt(numbers[1])) / 2; // Average of range
      } else if (numbers && numbers.length === 1) {
        return parseInt(numbers[0]); // Single value
      }
      return 0;
    }).filter(val => val > 0);
    
    if (salaryNumbers.length > 0) {
      averageSalary = Math.round(salaryNumbers.reduce((total, num) => total + num, 0) / salaryNumbers.length);
    }
  }

  // Status distribution
  const statusDistribution = {
    saved: applications.filter(app => app.status === 'saved').length,
    applied: applications.filter(app => app.status === 'applied').length,
    interviewing: applications.filter(app => app.status === 'interviewing').length,
    offer: applications.filter(app => app.status === 'offer').length,
    rejected: applications.filter(app => app.status === 'rejected').length
  };

  // Monthly trend data (last 6 months)
  const monthlyData = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const monthApplications = applications.filter(app => 
      app.createdAt >= monthDate && app.createdAt <= monthEnd
    );
    
    const monthInterviews = applications.filter(app => 
      app.status === 'interviewing' && app.updatedAt >= monthDate && app.updatedAt <= monthEnd
    );
    
    const monthOffers = applications.filter(app => 
      app.status === 'offer' && app.updatedAt >= monthDate && app.updatedAt <= monthEnd
    );

    monthlyData.push({
      month: monthDate.toLocaleString('default', { month: 'short' }),
      applications: monthApplications.length,
      interviews: monthInterviews.length,
      offers: monthOffers.length
    });
  }

  // Top companies - extract from applications with populated job data
  const companyStats = {};
  applications.forEach(app => {
    if (app.job && app.job.company) {
      const company = app.job.company;
      if (!companyStats[company]) {
        companyStats[company] = {
          applications: 0,
          interviews: 0,
          offers: 0
        };
      }
      
      companyStats[company].applications++;
      
      if (app.status === 'interviewing') {
        companyStats[company].interviews++;
      }
      
      if (app.status === 'offer') {
        companyStats[company].offers++;
      }
    }
  });

  const topCompanies = Object.entries(companyStats)
    .map(([name, stats]) => ({
      name,
      applications: stats.applications,
      interviews: stats.interviews,
      offers: stats.offers,
      successRate: stats.applications > 0 ? Math.round((stats.offers / stats.applications) * 100) : 0
    }))
    .sort((a, b) => b.applications - a.applications)
    .slice(0, 5);

  res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalApplications,
        interviewRate: `${interviewRate}%`,
        offerRate: `${offerRate}%`,
        averageResponseTime: `${averageResponseTime} days`,
        averageSalary: averageSalary > 0 ? `$${averageSalary.toLocaleString()}` : 'N/A'
      },
      statusDistribution,
      monthlyData,
      topCompanies
    }
  });
});

// @desc    Export analytics data
// @route   POST /api/analytics/export
// @access  Private
exports.exportAnalytics = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { format = 'csv' } = req.body;
  
  try {
    // Get analytics data using the same logic as getAnalytics
    const analyticsData = await exports.getAnalyticsData(userId, req.query.range || '30d');
    
    // For now, we'll just return a success message as the original code
    // In a real implementation, you would generate the actual file here
    const exportId = `export-${Date.now()}`;
    
    res.status(200).json({
      success: true,
      data: {
        exportId,
        format,
        message: 'Export request received. Your data will be processed shortly.',
        downloadUrl: `/api/analytics/download/${exportId}`
      }
    });
  } catch (error) {
    return next(new ErrorResponse('Failed to export analytics data', 500));
  }
});

// @desc    Download exported analytics data
// @route   GET /api/analytics/download/:id
// @access  Private
exports.downloadExport = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // In a real application, you would serve the actual file here
  // For now, we'll return a mock response
  res.status(200).json({
    success: true,
    data: {
      message: 'File download would start here',
      exportId: id
    }
  });
});

// Helper function to get analytics data (for internal use)
exports.getAnalyticsData = async (userId, range = '30d') => {
  // This would contain the same logic as getAnalytics but return data instead of response
  // Implementation would mirror getAnalytics but return raw data instead of response
  // This is a simplified version - you'd need to implement the full logic
  try {
    let startDate = new Date();
    // Date range calculation logic here (same as in getAnalytics)
    
    const applications = await Application.find({
      user: userId,
      createdAt: { $gte: startDate }
    }).populate('job', 'title company location salary');

    // Calculate metrics (same as in getAnalytics)
    // Return the data object instead of sending response
    return {
      metrics: {
        totalApplications: applications.length,
        // other metrics...
      },
      statusDistribution: {
        // status distribution data...
      },
      monthlyData: [
        // monthly data...
      ],
      topCompanies: [
        // top companies data...
      ]
    };
  } catch (error) {
    throw new Error('Failed to get analytics data');
  }
};
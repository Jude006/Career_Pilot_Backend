const Application = require('../models/Application');
const Job = require('../models/Job');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Get dashboard statistics and data
// @route   GET /api/dashboard
// @access  Private
exports.getDashboardData = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get date range for statistics (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get applications data
  const applications = await Application.find({
    user: userId,
    createdAt: { $gte: thirtyDaysAgo }
  }).populate('job', 'title company location salary');

  // Get previous period for comparison (30-60 days ago)
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const previousApplications = await Application.find({
    user: userId,
    createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
  });

  // Calculate statistics
  const totalApplications = applications.length;
  const interviewCount = applications.filter(app => app.status === 'interviewing').length;
  const offerCount = applications.filter(app => app.status === 'offer').length;
  const pendingCount = applications.filter(app => ['saved', 'applied'].includes(app.status)).length;

  // Calculate percentage changes
  const prevTotalApplications = previousApplications.length;
  const prevInterviewCount = previousApplications.filter(app => app.status === 'interviewing').length;
  const prevOfferCount = previousApplications.filter(app => app.status === 'offer').length;
  const prevPendingCount = previousApplications.filter(app => ['saved', 'applied'].includes(app.status)).length;

  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Get recent applications (last 5)
  const recentApplications = await Application.find({ user: userId })
    .populate('job', 'title company location')
    .sort({ createdAt: -1 })
    .limit(5);

  // Get upcoming interviews (next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const upcomingInterviews = await Application.find({
    user: userId,
    status: 'interviewing',
    interviewDate: { $gte: new Date(), $lte: nextWeek }
  }).populate('job', 'title company location');

  // Format response
  const stats = [
    {
      title: 'Total Applications',
      value: totalApplications,
      change: calculateChange(totalApplications, prevTotalApplications),
      icon: 'Briefcase',
      color: 'blue'
    },
    {
      title: 'Interviews',
      value: interviewCount,
      change: calculateChange(interviewCount, prevInterviewCount),
      icon: 'TrendingUp',
      color: 'green'
    },
    {
      title: 'Offers',
      value: offerCount,
      change: calculateChange(offerCount, prevOfferCount),
      icon: 'CheckCircle',
      color: 'purple'
    },
    {
      title: 'Pending',
      value: pendingCount,
      change: calculateChange(pendingCount, prevPendingCount),
      icon: 'Clock',
      color: 'orange'
    }
  ];

  // Format recent applications
  const formattedApplications = recentApplications.map(app => ({
    id: app._id,
    company: app.job?.company || 'Unknown Company',
    position: app.job?.title || 'Unknown Position',
    status: app.status,
    date: app.createdAt,
    logo: app.job?.company?.charAt(0) || 'U'
  }));

  // Format upcoming interviews
  const formattedInterviews = upcomingInterviews.map(interview => ({
    id: interview._id,
    company: interview.job?.company || 'Unknown Company',
    position: interview.job?.title || 'Unknown Position',
    date: interview.interviewDate,
    time: interview.interviewTime || 'TBD',
    type: interview.interviewType || 'Interview'
  }));

  res.status(200).json({
    success: true,
    data: {
      stats,
      recentApplications: formattedApplications,
      upcomingInterviews: formattedInterviews
    }
  });
});

// @desc    Get quick stats for dashboard cards
// @route   GET /api/dashboard/quick-stats
// @access  Private
exports.getQuickStats = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [applications, jobs, interviews] = await Promise.all([
    Application.countDocuments({ 
      user: userId, 
      createdAt: { $gte: thirtyDaysAgo } 
    }),
    Job.countDocuments({ 
      postedBy: userId, 
      createdAt: { $gte: thirtyDaysAgo } 
    }),
    Application.countDocuments({ 
      user: userId, 
      status: 'interviewing',
      createdAt: { $gte: thirtyDaysAgo } 
    })
  ]);

  res.status(200).json({
    success: true,
    data: {
      applications,
      jobs,
      interviews
    }
  });
});
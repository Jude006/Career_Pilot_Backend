const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const AIInsight = require('../models/AiInsight');
const Application = require('../models/Application');
const Job = require('../models/Job');
const User = require('../models/User');
const natural = require('natural');
const { WordTokenizer } = natural;
const tokenizer = new WordTokenizer();

// Enhanced AI Service with better mock data
const aiService = {
  analyzeResume: async (resumeText, userProfile) => {
    // Extract key information from resume
    const skills = extractSkills(resumeText);
    const experience = extractExperience(resumeText);
    const education = extractEducation(resumeText);
    
    // Calculate score based on content quality
    const score = calculateResumeScore(resumeText, skills, experience, education);
    
    return {
      score: score,
      strengths: [
        skills.technical.length > 0 ? 'Strong technical skills' : null,
        experience.years > 2 ? 'Relevant work experience' : null,
        education ? 'Good educational background' : null
      ].filter(Boolean),
      weaknesses: [
        skills.technical.length < 5 ? 'Could use more technical skills' : null,
        experience.years < 1 ? 'Limited work experience' : null,
        resumeText.length < 500 ? 'Resume content could be more detailed' : null
      ].filter(Boolean),
      recommendations: [
        'Include quantifiable achievements',
        'Add more industry-specific keywords',
        'Highlight your most relevant projects',
        'Consider obtaining certifications in your field'
      ]
    };
  },

  findJobMatches: async (userProfile, jobs) => {
    const userSkills = userProfile.skills || [];
    
    return jobs.map(job => {
      const jobSkills = job.skills || [];
      const matchingSkills = userSkills.filter(userSkill =>
        jobSkills.some(jobSkill =>
          jobSkill.toLowerCase().includes(userSkill.toLowerCase()) ||
          userSkill.toLowerCase().includes(jobSkill.toLowerCase())
        )
      );

      const matchScore = jobSkills.length > 0
        ? Math.min(Math.floor((matchingSkills.length / jobSkills.length) * 100) + 20, 95)
        : 60;

      return {
        jobId: job._id,
        jobTitle: job.title,
        company: job.company,
        matchScore: matchScore,
        matchingSkills: matchingSkills.slice(0, 5),
        suggestions: [
          `Highlight your ${matchingSkills.slice(0, 2).join(' and ')} experience`,
          'Emphasize relevant projects in your cover letter',
          'Research the company culture before applying'
        ]
      };
    }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  },

  prepareForInterview: async (job) => {
    return {
      questions: [
        'Tell me about yourself and your background',
        `Why are you interested in working at ${job.company}?`,
        'Describe a challenging project you worked on and how you handled it',
        'How do you stay updated with industry trends?',
        'Where do you see yourself in 5 years?'
      ],
      tips: [
        `Research ${job.company}'s recent projects and news`,
        'Review the job description thoroughly',
        'Prepare examples of your work that match their requirements',
        'Practice common behavioral interview questions',
        'Prepare questions to ask the interviewer'
      ]
    };
  }
};

// Helper functions
const extractSkills = (text) => {
  const technicalKeywords = [
    'javascript', 'python', 'java', 'react', 'node', 'express', 'mongodb',
    'sql', 'aws', 'docker', 'kubernetes', 'typescript', 'html', 'css',
    'vue', 'angular', 'php', 'ruby', 'rails', 'django', 'flask', 'git',
    'rest', 'api', 'graphql', 'postgresql', 'mysql', 'nosql', 'redis',
    'linux', 'nginx', 'jenkins', 'ci/cd', 'agile', 'scrum'
  ];

  const softKeywords = [
    'leadership', 'communication', 'teamwork', 'problem-solving',
    'adaptability', 'creativity', 'time management', 'critical thinking',
    'collaboration', 'presentation', 'mentoring', 'negotiation'
  ];

  const tokens = tokenizer.tokenize(text.toLowerCase()) || [];
  const technical = [...new Set(tokens.filter(token => technicalKeywords.includes(token)))];
  const soft = [...new Set(tokens.filter(token => softKeywords.includes(token)))];

  return { technical, soft };
};

const extractExperience = (text) => {
  const experiencePatterns = [
    /(\d+)\s*(?:years?|yrs?)\s*experience/gi,
    /experience:\s*(\d+)\s*years/gi,
    /(\d+)\+?\s*years/gi
  ];
  
  let years = 0;
  for (const pattern of experiencePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      const yearMatches = matches[0].match(/\d+/);
      if (yearMatches) {
        years = Math.max(years, parseInt(yearMatches[0]));
      }
    }
  }
  
  return { years };
};

const extractEducation = (text) => {
  const educationKeywords = [
    'bachelor', 'master', 'phd', 'degree', 'diploma', 'certificate',
    'university', 'college', 'school', 'graduated', 'education'
  ];
  
  const tokens = tokenizer.tokenize(text.toLowerCase()) || [];
  return tokens.some(token => educationKeywords.includes(token));
};

const calculateResumeScore = (text, skills, experience, education) => {
  let score = 40; // Base score

  // Content length (up to 20 points)
  score += Math.min(Math.floor(text.length / 50), 20);
  
  // Technical skills (up to 20 points)
  score += Math.min(skills.technical.length * 3, 20);
  
  // Experience (up to 15 points)
  score += Math.min(experience.years * 3, 15);
  
  // Education (5 points)
  if (education) score += 5;

  return Math.min(Math.max(score, 0), 100);
};

// AI Controller functions
exports.analyzeResume = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  if (!user.resume || !user.resume.textContent) {
    return next(new ErrorResponse('No resume found. Please upload a resume first.', 400));
  }

  const userProfile = {
    skills: user.skills || [],
    experience: user.experience || '',
    education: user.education || ''
  };

  const analysis = await aiService.analyzeResume(user.resume.textContent, userProfile);

  const insight = await AIInsight.create({
    user: req.user.id,
    type: 'resume_analysis',
    insights: analysis,
    score: analysis.score,
    recommendations: analysis.recommendations
  });

  // Update last analyzed date
  user.resume.lastAnalyzed = new Date();
  await user.save();

  res.status(200).json({
    success: true,
    data: insight
  });
});

exports.getJobMatches = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const jobs = await Job.find().limit(20);
  
  if (!user.resume || !user.resume.textContent) {
    return next(new ErrorResponse('No resume found. Please upload a resume first.', 400));
  }

  const userSkills = extractSkills(user.resume.textContent).technical;
  const userProfile = {
    skills: userSkills,
    experience: user.experience || '',
    education: user.education || ''
  };

  const matches = await aiService.findJobMatches(userProfile, jobs);

  const insight = await AIInsight.create({
    user: req.user.id,
    type: 'job_match',
    insights: { matches },
    score: Math.floor(matches.reduce((acc, match) => acc + match.matchScore, 0) / matches.length),
    recommendations: matches.flatMap(match => match.suggestions).slice(0, 5)
  });

  res.status(200).json({
    success: true,
    data: insight
  });
});

exports.prepareForInterview = asyncHandler(async (req, res, next) => {
  const { jobId } = req.body;
  
  const job = await Job.findById(jobId);
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  const preparation = await aiService.prepareForInterview(job);

  const insight = await AIInsight.create({
    user: req.user.id,
    type: 'interview_prep',
    insights: preparation,
    score: 85,
    recommendations: preparation.tips
  });

  res.status(200).json({
    success: true,
    data: insight
  });
});

exports.getAIDashboard = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  const recentInsights = await AIInsight.find({ 
    user: req.user.id,
    expiresAt: { $gt: new Date() }
  }).sort({ generatedAt: -1 }).limit(5);
  
  const jobMatches = await AIInsight.findOne({
    user: req.user.id,
    type: 'job_match',
    expiresAt: { $gt: new Date() }
  }).sort({ generatedAt: -1 });
  
  const resumeAnalysis = await AIInsight.findOne({
    user: req.user.id,
    type: 'resume_analysis',
    expiresAt: { $gt: new Date() }
  }).sort({ generatedAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      user: {
        hasResume: !!(user.resume && user.resume.fileUrl),
        lastAnalysis: user.resume?.lastAnalyzed,
        skills: user.skills || []
      },
      insights: recentInsights,
      jobMatches: jobMatches?.insights?.matches?.slice(0, 4) || [],
      resumeScore: resumeAnalysis?.score || 0
    }
  });
});

// Additional AI functions
exports.analyzeSkillGaps = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  const applications = await Application.find({ user: req.user.id }).populate('job');
  
  const jobSkills = new Set();
  applications.forEach(app => {
    if (app.job && app.job.skills) {
      app.job.skills.forEach(skill => jobSkills.add(skill.toLowerCase()));
    }
  });

  const userSkills = new Set();
  if (user.resume && user.resume.textContent) {
    const skills = extractSkills(user.resume.textContent);
    skills.technical.forEach(skill => userSkills.add(skill.toLowerCase()));
  }
  
  user.skills?.forEach(skill => userSkills.add(skill.toLowerCase()));

  const missingSkills = Array.from(jobSkills).filter(skill => !userSkills.has(skill));
  const strongSkills = Array.from(userSkills).filter(skill => jobSkills.has(skill));

  const insight = await AIInsight.create({
    user: req.user.id,
    type: 'skill_gap',
    insights: { missingSkills, strongSkills },
    score: Math.floor((strongSkills.length / (jobSkills.size || 1)) * 100),
    recommendations: [
      `Focus on learning: ${missingSkills.slice(0, 3).join(', ')}`,
      'Consider online courses for missing skills',
      'Look for projects that use these technologies'
    ]
  });

  res.status(200).json({
    success: true,
    data: insight
  });
});
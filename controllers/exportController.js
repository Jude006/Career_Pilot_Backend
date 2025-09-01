const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const Application = require('../models/Application');
const Job = require('../models/Job');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Export data in various formats
// @route   POST /api/export
// @access  Private
exports.exportData = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { format, dataTypes, dateRange } = req.body;

  // Validate format
  const validFormats = ['csv', 'excel', 'json', 'pdf'];
  if (!validFormats.includes(format)) {
    return next(new ErrorResponse('Invalid export format', 400));
  }

  // Calculate date range
  let startDate = new Date();
  switch (dateRange) {
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
    default:
      startDate = new Date(0); // Unix epoch
  }

  // Prepare data based on selected types
  const exportData = {};
  
  if (dataTypes.includes('applications')) {
    exportData.applications = await Application.find({
      user: userId,
      createdAt: { $gte: startDate }
    }).populate('job', 'title company location salary');
  }

  if (dataTypes.includes('jobs')) {
    exportData.jobs = await Job.find({
      postedBy: userId,
      createdAt: { $gte: startDate }
    });
  }

  // Generate file based on format
  let fileName, fileContent;

  try {
    switch (format) {
      case 'csv':
        const result = await generateCSV(exportData);
        fileName = result.fileName;
        fileContent = result.content;
        res.setHeader('Content-Type', 'text/csv');
        break;

      case 'excel':
        const excelResult = await generateExcel(exportData);
        fileName = excelResult.fileName;
        fileContent = excelResult.content;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        break;

      case 'json':
        fileName = `careerpilot_export_${Date.now()}.json`;
        fileContent = JSON.stringify(exportData, null, 2);
        res.setHeader('Content-Type', 'application/json');
        break;

      case 'pdf':
        const pdfResult = await generatePDF(exportData);
        fileName = pdfResult.fileName;
        fileContent = pdfResult.content;
        res.setHeader('Content-Type', 'application/pdf');
        break;
    }

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send the file
    res.send(fileContent);
  } catch (error) {
    return next(new ErrorResponse('Failed to generate export file', 500));
  }
});

// @desc    Get export history
// @route   GET /api/export/history
// @access  Private
exports.getExportHistory = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  
  // Get actual export history from database
  try {
    // This would query a ExportHistory model in a real application
    // For now, return empty array or mock data
    const exportHistory = [];
    
    res.status(200).json({
      success: true,
      data: exportHistory
    });
  } catch (error) {
    return next(new ErrorResponse('Failed to fetch export history', 500));
  }
});

// Helper function to generate CSV
const generateCSV = async (data) => {
  const fields = [];
  const dataToExport = [];

  if (data.applications && data.applications.length > 0) {
    fields.push(...['Job Title', 'Company', 'Status', 'Applied Date', 'Response Date', 'Location', 'Salary']);
    
    data.applications.forEach(app => {
      dataToExport.push({
        'Job Title': app.job?.title || 'N/A',
        'Company': app.job?.company || 'N/A',
        'Status': app.status,
        'Applied Date': app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : 'N/A',
        'Response Date': app.responseDate ? new Date(app.responseDate).toLocaleDateString() : 'N/A',
        'Location': app.job?.location || 'N/A',
        'Salary': app.job?.salary || 'N/A'
      });
    });
  }

  if (data.jobs && data.jobs.length > 0) {
    if (fields.length === 0) {
      fields.push(...['Job Title', 'Company', 'Location', 'Salary', 'Type', 'Experience', 'Skills']);
    }
    
    data.jobs.forEach(job => {
      dataToExport.push({
        'Job Title': job.title || 'N/A',
        'Company': job.company || 'N/A',
        'Location': job.location || 'N/A',
        'Salary': job.salary || 'N/A',
        'Type': job.type || 'N/A',
        'Experience': job.experience || 'N/A',
        'Skills': job.skills ? job.skills.join(', ') : 'N/A'
      });
    });
  }

  if (dataToExport.length === 0) {
    throw new Error('No data available for export');
  }

  const parser = new Parser({ fields });
  const csv = parser.parse(dataToExport);

  return {
    fileName: `careerpilot_export_${Date.now()}.csv`,
    content: csv
  };
};

// Helper function to generate Excel
const generateExcel = async (data) => {
  const workbook = new ExcelJS.Workbook();
  
  if (data.applications && data.applications.length > 0) {
    const worksheet = workbook.addWorksheet('Applications');
    
    // Add headers
    worksheet.columns = [
      { header: 'Job Title', key: 'title', width: 25 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Applied Date', key: 'appliedDate', width: 15 },
      { header: 'Response Date', key: 'responseDate', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Salary', key: 'salary', width: 15 }
    ];
    
    // Add data
    data.applications.forEach(app => {
      worksheet.addRow({
        title: app.job?.title || 'N/A',
        company: app.job?.company || 'N/A',
        status: app.status,
        appliedDate: app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : 'N/A',
        responseDate: app.responseDate ? new Date(app.responseDate).toLocaleDateString() : 'N/A',
        location: app.job?.location || 'N/A',
        salary: app.job?.salary || 'N/A'
      });
    });
    
    // Style headers
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
  }

  if (data.jobs && data.jobs.length > 0) {
    const worksheet = workbook.addWorksheet('Jobs');
    
    // Add headers
    worksheet.columns = [
      { header: 'Job Title', key: 'title', width: 25 },
      { header: 'Company', key: 'company', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Salary', key: 'salary', width: 15 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Experience', key: 'experience', width: 15 },
      { header: 'Skills', key: 'skills', width: 30 }
    ];
    
    // Add data
    data.jobs.forEach(job => {
      worksheet.addRow({
        title: job.title || 'N/A',
        company: job.company || 'N/A',
        location: job.location || 'N/A',
        salary: job.salary || 'N/A',
        type: job.type || 'N/A',
        experience: job.experience || 'N/A',
        skills: job.skills ? job.skills.join(', ') : 'N/A'
      });
    });
    
    // Style headers
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
  }

  if (workbook.worksheets.length === 0) {
    throw new Error('No data available for export');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  
  return {
    fileName: `careerpilot_export_${Date.now()}.xlsx`,
    content: buffer
  };
};

// Helper function to generate PDF
const generatePDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve({
          fileName: `careerpilot_export_${Date.now()}.pdf`,
          content: result
        });
      });
      doc.on('error', reject);
      
      // Add content to PDF
      doc.fontSize(20).text('CareerPilot Export', { align: 'center' });
      doc.moveDown();
      
      if (data.applications && data.applications.length > 0) {
        doc.fontSize(16).text('Job Applications');
        doc.moveDown();
        
        data.applications.forEach((app, index) => {
          doc.fontSize(12)
            .text(`${index + 1}. ${app.job?.title || 'N/A'} at ${app.job?.company || 'N/A'}`)
            .text(`   Status: ${app.status}`)
            .text(`   Applied: ${app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : 'N/A'}`)
            .text(`   Location: ${app.job?.location || 'N/A'}`);
          doc.moveDown();
        });
      }
      
      if (data.jobs && data.jobs.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Job Listings');
        doc.moveDown();
        
        data.jobs.forEach((job, index) => {
          doc.fontSize(12)
            .text(`${index + 1}. ${job.title || 'N/A'} at ${job.company || 'N/A'}`)
            .text(`   Location: ${job.location || 'N/A'}`)
            .text(`   Salary: ${job.salary || 'N/A'}`)
            .text(`   Type: ${job.type || 'N/A'}`)
            .text(`   Experience: ${job.experience || 'N/A'}`)
            .text(`   Skills: ${job.skills ? job.skills.join(', ') : 'N/A'}`);
          doc.moveDown();
        });
      }
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const pdfPath = path.resolve('public', 'Building_India_Digital_Work_Allocator_User_Guide.pdf');

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true
});

const stream = fs.createWriteStream(pdfPath);
doc.pipe(stream);

// Color Palette
const PRIMARY = '#3730a3'; // Indigo 800
const ACCENT = '#4f46e5';  // Indigo 600
const TEXT_DARK = '#0f172a'; // Slate 900
const TEXT_MUTED = '#475569'; // Slate 600
const BG_LIGHT = '#f8fafc';  // Slate 50
const BORDER_COLOR = '#cbd5e1'; // Slate 300

// Helper functions for PDF styling
function renderHeader(title, subtitle) {
  doc.rect(40, 40, 515, 65).fill(PRIMARY);
  
  doc.fillColor('#ffffff')
     .fontSize(18)
     .font('Helvetica-Bold')
     .text('BUILDING INDIA DIGITAL', 55, 52);

  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('#c7d2fe')
     .text(title.toUpperCase(), 55, 75);

  if (subtitle) {
    doc.fontSize(9)
       .fillColor('#e0e7ff')
       .text(subtitle, 55, 88);
  }

  doc.y = 120;
}

function renderSectionTitle(num, title) {
  doc.moveDown(0.8);
  const currentY = doc.y;

  doc.rect(40, currentY, 515, 24).fill('#e0e7ff');
  
  doc.fillColor(PRIMARY)
     .fontSize(12)
     .font('Helvetica-Bold')
     .text(`${num}. ${title.toUpperCase()}`, 48, currentY + 6);

  doc.y = currentY + 32;
}

function renderSubSection(title) {
  doc.moveDown(0.4);
  doc.fillColor(ACCENT)
     .fontSize(11)
     .font('Helvetica-Bold')
     .text(title);
  doc.moveDown(0.2);
}

function renderParagraph(text) {
  doc.fillColor(TEXT_DARK)
     .fontSize(9.5)
     .font('Helvetica')
     .text(text, { align: 'justify', lineGap: 3 });
  doc.moveDown(0.4);
}

function renderBullet(title, desc) {
  const currentY = doc.y;
  doc.circle(48, currentY + 5, 2.5).fill(ACCENT);
  
  doc.fillColor(TEXT_DARK)
     .fontSize(9.5)
     .font('Helvetica-Bold')
     .text(title + ': ', 58, currentY, { continued: true })
     .font('Helvetica')
     .fillColor(TEXT_MUTED)
     .text(desc, { lineGap: 2 });
  
  doc.moveDown(0.3);
}

function renderCallout(boxTitle, text) {
  const startY = doc.y;
  doc.rect(40, startY, 515, 42).fillAndStroke(BG_LIGHT, BORDER_COLOR);
  
  doc.fillColor(PRIMARY)
     .fontSize(9.5)
     .font('Helvetica-Bold')
     .text('📌 ' + boxTitle, 50, startY + 8);

  doc.fillColor(TEXT_MUTED)
     .fontSize(8.5)
     .font('Helvetica')
     .text(text, 50, startY + 22, { width: 495 });

  doc.y = startY + 50;
}

// PAGE 1: TITLE & SYSTEM OVERVIEW
renderHeader('User Guide & Complete Feature Documentation', 'Step-by-Step Client Manual for Work Allocator Portal');

renderSectionTitle('1', 'System Overview & Access Portals');

renderParagraph(
  'The Building India Digital Work Allocator Portal is an enterprise-grade cloud system engineered for seamless task allocation, real-time employee attendance, automated pro-rata payroll processing, and client workflow tracking.'
);

renderBullet(
  'Allocator Admin Console',
  'Accessible at https://workallocater.buildingindiadigital.com/ — Designed exclusively for Management & Allocators to create employees, assign daily tasks, review submitted work, handle leaves, and issue PDF salary slips.'
);

renderBullet(
  'Employee Portal Login',
  'Accessible at https://workallocater.buildingindiadigital.com/employee — Dedicated portal for employees to view assigned tasks, log work done & hurdles, clock attendance, apply for leaves, and receive broadcast notices.'
);

renderBullet(
  '3-Second White Splash Screen',
  'Features a 3-second animated gradient buffer progress bar (#ffffff background) with company logo and live status percentage on app load.'
);

renderCallout(
  'Dual-Portal Separation',
  'Both portals operate on isolated authentication flows. Allocators manage team operations while employees view only their assigned tasks and confidential dashboards.'
);

renderSectionTitle('2', 'Allocator Admin Console — Step-by-Step Guide');

renderSubSection('Step 1: Employee & Salary Infrastructure Management');
renderBullet(
  'Adding Employees',
  'Navigate to "Employees & Clients" tab. Input full name, role, employee code (e.g. BID-101), color tag, and confidential Base Monthly Salary (only visible to Allocators).'
);
renderBullet(
  'Credentials & Passwords',
  'Click the Key icon to generate employee login credentials. If an employee forgets their password, a live notification banner (🔔 Employee Password Reset Requests) appears for instant password resets.'
);
renderBullet(
  'Resume Request & Storage',
  'Request employee resumes with one click. Uploaded resumes can be previewed or downloaded directly from the employee card.'
);

renderSubSection('Step 2: Client & Brand Registration');
renderBullet(
  'Adding Clients',
  'Input Client Brand Name (e.g. Nike India) and Industry Vertical. Once added, clients appear immediately in task allocation dropdowns.'
);

// PAGE BREAK TO PAGE 2
doc.addPage();
renderHeader('Allocator Admin Console (Continued)', 'Work Allocation, Attendance, Leave & Payroll Engine');

renderSectionTitle('2', 'Allocator Admin Console (Continued)');

renderSubSection('Step 3: Work Allocation & Task Scheduling');
renderBullet(
  'Batch Task Assignment',
  'Select an employee and date. Add single or multiple tasks with task type (Reel, Story, Post, Printable, Video), client brand, drive URL, MP3/MP4 media links, and specific Allocator Remarks.'
);
renderBullet(
  'Task Review & Approval',
  'View submitted employee reports (Work Done Details & Hurdles Faced). Allocators can approve or disapprove work with custom review remarks.'
);

renderSubSection('Step 4: Attendance & Time-Tracking Logs');
renderBullet(
  'Live Session Monitoring',
  'Track real-time Clock-In/Clock-Out times, active session duration (hours and minutes), and completion status in IST time.'
);
renderBullet(
  'Editing & Deleting Logs',
  'Edit clock-in/out times or delete mis-logged attendance records using the Trash icon.'
);

renderSubSection('Step 5: Leave Management & Approvals');
renderBullet(
  'Reviewing Leave Proofs',
  'Inspect employee leave applications, dates, reason notes, and attached medical/proof documents.'
);
renderBullet(
  'Approval / Disapproval',
  'Approve or disapprove requests with feedback. Disapproved applications prompt employees to upload supporting proof for resubmission.'
);

renderSubSection('Step 6: Automated Pro-Rata Salary Slip Engine & PDF Export');
renderBullet(
  'Pro-Rata Salary Calculation',
  'Select employee and billing month (YYYY-MM). The engine automatically calculates earned work salary based on actual work hours logged vs. standard expected monthly hours (e.g., 200h).'
);
renderBullet(
  'Allowances & Deductions',
  'Add custom bonuses/allowances, work shortfall deductions, and extra deductions with instant Net Salary calculation.'
);
renderBullet(
  'Salary Slip Edit Modal',
  'Click the Edit (pencil) button on any generated salary slip to update base salary, allowances, or remarks in Firestore.'
);
renderBullet(
  'Full-Page A4 PDF Printing',
  'Click Print / Download PDF. Formatted with zero top margin, high-resolution company logo, address header, and employee code.'
);

// PAGE BREAK TO PAGE 3
doc.addPage();
renderHeader('Employee Portal & Client Workflow Guide', 'Daily Task Reporting, Attendance & Bell Notifications');

renderSectionTitle('3', 'Employee Portal — Step-by-Step Guide');

renderSubSection('Step 1: Portal Access & Password Management');
renderBullet(
  'Dedicated Employee Login',
  'Access https://workallocater.buildingindiadigital.com/employee. Enter assigned username and password with password unmasking toggle.'
);
renderBullet(
  'Forgot Password Request',
  'Click "Forgot Password?" to submit a reset request note directly to the Allocator Admin Console.'
);

renderSubSection('Step 2: Responsive Tabular Task List & Reporting');
renderBullet(
  'Tabular Task View',
  'Tasks are displayed in a clean, responsive table showing Date, Client, Task Type, Uploaded Drive/MP3/MP4 Links, Allocator Remarks, and Status.'
);
renderBullet(
  'Writing Work Reports & Hurdles',
  'Click the Report button to write Work Done Details and Hurdles Faced. Submit work as Completed or Incompleted for Allocator review.'
);
renderBullet(
  'Deleting Tasks',
  'Employees can delete or clear assigned task rows using the red Trash icon.'
);

renderSubSection('Step 3: Task Assignment Bell Notification Drawer');
renderBullet(
  'Real-Time Unread Badge',
  'A top-header Bell Icon (🔔) displays a live red badge (e.g. 🔴 2) whenever the Allocator assigns a new task.'
);
renderBullet(
  'Mark as Read & Clear All',
  'Opening the notification drawer allows employees to click "Mark as Read" or "Clear All" to permanently dismiss notifications.'
);

renderSubSection('Step 4: Digital Attendance Clock-In / Clock-Out');
renderBullet(
  'Single-Tap Clocking',
  'Click "Clock In" to begin work session. The live IST clock tracks active duration. Click "Clock Out" at end of shift.'
);

renderSubSection('Step 5: Leave Applications & Shared Broadcasts');
renderBullet(
  'Applying for Leave',
  'Select dates, leave type, reason, and attach supporting files (PDF/DOCX).'
);
renderBullet(
  'Shared Files & Notices',
  'View company announcements, birthday wishes, and download shared files.'
);

renderSectionTitle('4', 'Excel Export & Reporting');
renderParagraph(
  'All work records and attendance data can be exported to formatted Microsoft Excel (.xlsx) files. Work durations are cleanly formatted as "Xh Ym" for error-free audit and accounting.'
);

// FOOTER ON ALL PAGES
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.fillColor(TEXT_MUTED)
     .fontSize(8)
     .font('Helvetica')
     .text(
       `Building India Digital Work Allocator — Page ${i + 1} of ${range.count}`,
       40,
       800,
       { align: 'center', width: 515 }
     );
}

doc.end();

stream.on('finish', () => {
  console.log(`✅ PDF User Guide created successfully at: ${pdfPath}`);
});

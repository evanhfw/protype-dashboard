import { ParsedStudent, Course, Attendance, mapStatus } from '@/data/parsedData';

export interface ParseResult {
  success: boolean;
  students?: ParsedStudent[];
  error?: string;
}

/**
 * Parse student data from HTML string
 * Extracts student names, status, and course progress
 */
export const parseStudentHTML = (htmlString: string): ParseResult => {
  try {
    // Validate input
    if (!htmlString || htmlString.trim().length === 0) {
      return {
        success: false,
        error: 'HTML content is empty',
      };
    }

    // Normalize HTML: Replace all consecutive whitespace with single space
    // This fixes status detection when text has line breaks (e.g., "In\nProgress", "Need\nSpecial\nAttention")
    const normalizedHtml = htmlString.replace(/\s+/g, ' ').trim();

    // Parse HTML using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalizedHtml, 'text/html');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return {
        success: false,
        error: 'Invalid HTML structure',
      };
    }

    // Find all student sections by old h3 markup or current profile-link span markup
    const studentHeaders = doc.querySelectorAll('h3.text-3xl.font-semibold, section[data-element="profile"] a[href^="/u/"] span.block.overflow-hidden.font-bold');

    if (studentHeaders.length === 0) {
      return {
        success: false,
        error: 'No students found in HTML. Make sure the HTML structure is correct.',
      };
    }

    const students: ParsedStudent[] = [];

    studentHeaders.forEach((header) => {
      const studentName = header.textContent?.trim() || '';
      
      if (!studentName) return;

      // Find the parent container
      let container = header.parentElement;
      while (container && !container.classList.contains('container')) {
        container = container.parentElement;
      }

      if (!container) return;

      // Extract profile picture URL from img tag
      let imageUrl: string | undefined = undefined;
      const imgElement = container.querySelector('img');
      if (imgElement && imgElement.src) {
        imageUrl = imgElement.src;
      }

      // Extract status from div.w-full.py-3.text-center > p
      let status: string | null = null;
      
      // Find the status paragraph
      const statusDiv = container.querySelector('div.w-full.py-3.text-center');
      
      if (statusDiv) {
        const statusP = statusDiv.querySelector('p');
        
        if (statusP) {
          // Get text and normalize all whitespace (including newlines, tabs, etc)
          const rawText = statusP.textContent || '';
          const statusText = rawText.replace(/\s+/g, ' ').trim();
          
          // Check for status keywords - use includes for flexibility
          if (statusText.includes('Need Special Attention')) {
            status = 'Need Special Attention';
          } else if (statusText.includes('Special Attention')) {
            status = 'Special Attention';
          } else if (statusText.includes('Lagging')) {
            status = 'Lagging';
          } else if (statusText.includes('Ideal')) {
            status = 'Ideal';
          } else if (statusText.includes('Ahead')) {
            status = 'Ahead';
          } else if (statusText.includes('On Track')) {
            status = 'On Track';
          }
        }
      }

      // Extract courses from section.attendances
      const courses: Course[] = [];
      const attendanceSections = container.querySelectorAll('section.attendances');

      attendanceSections.forEach((section) => {
        // Find all progress bars in this section
        const progressBars = section.querySelectorAll<HTMLElement>('div[style*="width:"]');
        
        progressBars.forEach((progressBar) => {
          if (progressBar.style.width) {
            const percentage = progressBar.style.width;
            
            // Find the parent container that has the course information (border-b class)
            let courseContainer: HTMLElement | null = progressBar.parentElement;
            let depth = 0;
            while (courseContainer && depth < 10) {
              if (courseContainer.classList.contains('border-b')) {
                break;
              }
              courseContainer = courseContainer.parentElement;
              depth++;
            }
            
            if (courseContainer && courseContainer.classList.contains('border-b')) {
              // Get the text content - it's all in one line
              const fullText = courseContainer.textContent?.trim() || '';
              
              // Pattern: "Course Name39%In ProgressIn Progress" or "Course Name0%Not StartedNot Started"
              // Split by newlines first to get the first meaningful line
              const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
              let courseName = lines[0] || '';
              
              // If first line has percentage, extract before it
              const percentMatch = courseName.match(/^(.+?)(\d+%).*$/);
              if (percentMatch) {
                courseName = percentMatch[1].trim();
              }
              
              // Skip if not a valid course (more lenient validation)
              if (courseName && 
                  courseName.length >= 5 && 
                  courseName.length < 200 &&
                  !courseName.toLowerCase().includes('total point') &&
                  !courseName.toLowerCase().includes('course progress') &&
                  !courseName.toLowerCase().includes('your learning') &&
                  !courseName.toLowerCase().includes('attendance') &&
                  !courseName.toLowerCase().includes('last updated')) {
                
                // Extract course status
                let courseStatus: Course['status'] = 'Not Started';
                if (fullText.includes('Completed')) {
                  courseStatus = 'Completed';
                } else if (fullText.includes('In Progress')) {
                  courseStatus = 'In Progress';
                }

                // Fix progress: "Not Started" courses should have 0% progress
                // Platform default is 2% for enrolled but not started courses
                let finalProgress = percentage;
                if (courseStatus === 'Not Started') {
                  finalProgress = '0%';
                }

                courses.push({
                  name: courseName,
                  progress: finalProgress,
                  status: courseStatus,
                });
              }
            }
          }
        });
      });

      // Extract attendances from data-event-name elements
      const attendances: Attendance[] = [];
      const attendanceItems = container.querySelectorAll('[data-element="item-status"][data-event-name]');
      attendanceItems.forEach((item) => {
        const event = item.getAttribute('data-event-name') || '';
        const statusLabel = item.querySelector('[data-element="item-status-label"]');
        const attStatus = statusLabel?.textContent?.trim() || '';
        if (event) {
          attendances.push({
            event,
            status: attStatus as Attendance['status'],
          });
        }
      });

      // Add student to list
      students.push({
        name: studentName,
        status: mapStatus(status),
        courses,
        attendances: attendances.length > 0 ? attendances : undefined,
        imageUrl,
        profile: {
          university: '',
          major: '',
          photoUrl: imageUrl || '',
          profileLink: '',
        },
      });
    });

    if (students.length === 0) {
      return {
        success: false,
        error: 'No valid student data found in HTML',
      };
    }

    return {
      success: true,
      students,
    };
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred while parsing HTML',
    };
  }
};

/**
 * Validate file size (max 10MB)
 */
export const validateFileSize = (file: File): boolean => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  return file.size <= maxSize;
};

/**
 * Read file as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
};

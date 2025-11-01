// src/services/sampleJobsData.ts
import { JobListing } from '../types/jobs';

// Sample job data for demonstration
export const sampleJobs: JobListing[] = [
  {
    id: '1',
    company_name: 'Google',
    company_logo_url: 'https://images.pexels.com/photos/270408/pexels-photo-270408.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Software Engineer',
    package_amount: 1500000,
    package_type: 'CTC',
    domain: 'SDE',
    location_type: 'Hybrid',
    location_city: 'Bangalore',
    experience_required: '0-2 years',
    qualification: 'B.Tech/B.E in Computer Science',
    eligible_years: '2024, 2025',
    short_description: 'Join Google as a Software Engineer and work on products that impact billions of users worldwide.',
    full_description: 'We are looking for passionate software engineers to join our team and build the next generation of products that will change how people connect, explore, and interact with information.',
    application_link: 'https://careers.google.com/jobs/results/',
    posted_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    company_name: 'Microsoft',
    company_logo_url: 'https://images.pexels.com/photos/159304/network-cable-ethernet-computer-159304.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Data Scientist',
    package_amount: 1200000,
    package_type: 'CTC',
    domain: 'Data Science',
    location_type: 'Remote',
    experience_required: '1-3 years',
    qualification: 'M.Tech/M.S in Data Science or related field',
    eligible_years: '2023, 2024',
    short_description: 'Work with cutting-edge AI and machine learning technologies at Microsoft.',
    full_description: 'Microsoft is seeking a talented Data Scientist to join our AI research team and develop innovative solutions using machine learning and artificial intelligence.',
    application_link: 'https://careers.microsoft.com/us/en/search-results',
    posted_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    company_name: 'Amazon',
    company_logo_url: 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Product Manager',
    package_amount: 1800000,
    package_type: 'CTC',
    domain: 'Product',
    location_type: 'Onsite',
    location_city: 'Seattle',
    experience_required: '3-5 years',
    qualification: 'MBA or equivalent experience',
    eligible_years: '2022, 2023',
    short_description: 'Lead product strategy and development for Amazon\'s next-generation services.',
    full_description: 'Join Amazon as a Product Manager and drive the vision, strategy, and roadmap for products that serve millions of customers worldwide.',
    application_link: 'https://amazon.jobs/en/',
    posted_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4',
    company_name: 'Flipkart',
    company_logo_url: 'https://images.pexels.com/photos/356056/pexels-photo-356056.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Frontend Developer',
    package_amount: 800000,
    package_type: 'CTC',
    domain: 'SDE',
    location_type: 'Hybrid',
    location_city: 'Bangalore',
    experience_required: '1-2 years',
    qualification: 'B.Tech/B.E in Computer Science',
    eligible_years: '2024, 2025',
    short_description: 'Build responsive and user-friendly interfaces for Flipkart\'s e-commerce platform.',
    full_description: 'We are looking for a talented Frontend Developer to join our team and create amazing user experiences for millions of customers on Flipkart.',
    application_link: 'https://www.flipkartcareers.com/',
    posted_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '5',
    company_name: 'Zomato',
    company_logo_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Marketing Intern',
    package_amount: 25000,
    package_type: 'stipend',
    domain: 'Marketing',
    location_type: 'Remote',
    experience_required: '0-1 years',
    qualification: 'Currently pursuing MBA/BBA',
    eligible_years: '2025, 2026',
    short_description: 'Join Zomato\'s marketing team and help grow India\'s largest food delivery platform.',
    full_description: 'We are looking for creative and data-driven marketing interns to join our team and help execute marketing campaigns that reach millions of users.',
    application_link: 'https://www.zomato.com/careers',
    posted_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '6',
    company_name: 'Swiggy',
    company_logo_url: 'https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=100',
    role_title: 'Business Analyst',
    package_amount: 1000000,
    package_type: 'CTC',
    domain: 'Analytics',
    location_type: 'Onsite',
    location_city: 'Mumbai',
    experience_required: '2-4 years',
    qualification: 'B.Tech/MBA with analytical background',
    eligible_years: '2023, 2024',
    short_description: 'Analyze business metrics and drive data-informed decisions at India\'s leading food delivery company.',
    full_description: 'Join Swiggy as a Business Analyst and help us understand customer behavior, optimize operations, and drive business growth through data-driven insights.',
    application_link: 'https://careers.swiggy.com/',
    posted_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    source_api: 'manual',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Mock function to simulate API calls
export const fetchJobListings = async (filters: any = {}, limit = 20, offset = 0) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  let filteredJobs = [...sampleJobs];

  // Apply filters
  if (filters.domain) {
    filteredJobs = filteredJobs.filter(job => job.domain === filters.domain);
  }

  if (filters.location_type) {
    filteredJobs = filteredJobs.filter(job => job.location_type === filters.location_type);
  }

  if (filters.experience_required) {
    filteredJobs = filteredJobs.filter(job => job.experience_required === filters.experience_required);
  }

  if (filters.package_min) {
    filteredJobs = filteredJobs.filter(job => 
      job.package_amount && job.package_amount >= filters.package_min
    );
  }

  if (filters.package_max) {
    filteredJobs = filteredJobs.filter(job => 
      job.package_amount && job.package_amount <= filters.package_max
    );
  }

  if (filters.eligible_year) {
    const yearSearch = String(filters.eligible_year).toLowerCase();
    filteredJobs = filteredJobs.filter(job =>
      job.eligible_years?.toLowerCase().includes(yearSearch)
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredJobs = filteredJobs.filter(job => 
      job.role_title.toLowerCase().includes(searchTerm) ||
      job.company_name.toLowerCase().includes(searchTerm) ||
      job.domain.toLowerCase().includes(searchTerm)
    );
  }

  // Apply sorting
  if (filters.sort_by) {
    filteredJobs.sort((a, b) => {
      let aValue = a[filters.sort_by as keyof JobListing];
      let bValue = b[filters.sort_by as keyof JobListing];

      if (filters.sort_by === 'posted_date') {
        aValue = new Date(a.posted_date).getTime();
        bValue = new Date(b.posted_date).getTime();
      }

      if (filters.sort_order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }

  // Apply pagination
  const paginatedJobs = filteredJobs.slice(offset, offset + limit);

  return {
    jobs: paginatedJobs,
    total: filteredJobs.length,
    hasMore: offset + limit < filteredJobs.length
  };
};

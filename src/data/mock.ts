import type {
  Scholarship,
  Application,
  VaultDocument,
  AppNotification,
  MatchResult,
} from './types'

export const STUDENT = {
  name: 'Benjamin Darko',
  firstName: 'Benjamin',
  email: 'benjamin.darko@st.knust.edu.gh',
  phone: '+233 24 712 0098',
  studentId: '1821122',
  programme: 'BSc Computer Engineering',
  institution: 'Kwame Nkrumah University of Science & Technology',
  level: '100 · First Year',
  region: 'Ashanti',
  homeDistrict: 'Kumasi Metropolitan',
  wassceAggregate: 8,
  gender: 'Male',
  needLevel: 'High',
  avatarColor: 'from-brand-500 to-brand-700',
}

export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

// Catalogue of programmes offered across Ghanaian universities (UG, KNUST,
// UCC, UEW, UMaT, UDS, GIMPA, Ashesi, …), grouped by discipline for the
// programme pickers. Students whose programme still isn't here use the
// free-text "Other" option — the catalogue helps, it never blocks.
export const PROGRAMME_GROUPS: { group: string; items: string[] }[] = [
  {
    group: 'Engineering & Technology',
    items: [
      'BSc Aerospace Engineering', 'BSc Agricultural Engineering',
      'BSc Automobile Engineering', 'BSc Biomedical Engineering',
      'BSc Chemical Engineering', 'BSc Civil Engineering',
      'BSc Computer Engineering', 'BSc Electrical/Electronic Engineering',
      'BSc Geological Engineering', 'BSc Geomatic Engineering',
      'BSc Marine Engineering', 'BSc Materials Engineering',
      'BSc Mechanical Engineering', 'BSc Metallurgical Engineering',
      'BSc Mining Engineering', 'BSc Petroleum Engineering',
      'BSc Renewable Energy Engineering', 'BSc Telecommunications Engineering',
    ],
  },
  {
    group: 'Computing & ICT',
    items: [
      'BSc Computer Science', 'BSc Cybersecurity', 'BSc Data Science',
      'BSc Information Systems', 'BSc Information Technology',
      'BSc Software Engineering',
    ],
  },
  {
    group: 'Physical & Mathematical Sciences',
    items: [
      'BSc Actuarial Science', 'BSc Chemistry', 'BSc Earth Science',
      'BSc Environmental Science', 'BSc Mathematics', 'BSc Physics',
      'BSc Statistics',
    ],
  },
  {
    group: 'Life Sciences',
    items: [
      'BSc Biochemistry', 'BSc Biological Sciences', 'BSc Biotechnology',
      'BSc Molecular Biology and Genetics',
    ],
  },
  {
    group: 'Health Sciences',
    items: [
      'MBChB Medicine and Surgery', 'BDS Dental Surgery',
      'PharmD Pharmacy', 'BSc Nursing', 'BSc Midwifery',
      'BSc Physician Assistantship', 'BSc Medical Laboratory Science',
      'BSc Radiography', 'BSc Physiotherapy', 'OD Optometry',
      'BSc Public Health', 'BSc Nutrition and Dietetics',
      'DVM Veterinary Medicine', 'BSc Herbal Medicine',
    ],
  },
  {
    group: 'Agriculture & Natural Resources',
    items: [
      'BSc Agriculture', 'BSc Agribusiness Management', 'BSc Animal Science',
      'BSc Crop Science', 'BSc Fisheries and Aquaculture',
      'BSc Food Science and Technology', 'BSc Forestry',
      'BSc Natural Resources Management',
    ],
  },
  {
    group: 'Business & Economics',
    items: [
      'BSc Accounting', 'BSc Banking and Finance', 'BSc Business Administration',
      'BA Economics', 'BSc Hospitality and Tourism Management',
      'BSc Human Resource Management', 'BSc Management Studies',
      'BSc Marketing', 'BSc Procurement and Supply Chain Management',
    ],
  },
  {
    group: 'Law',
    items: ['LLB Law'],
  },
  {
    group: 'Social Sciences & Communication',
    items: [
      'BA Communication Studies', 'BA Geography and Resource Development',
      'BA International Relations', 'BA Political Science', 'BSc Psychology',
      'BA Social Work', 'BA Sociology',
    ],
  },
  {
    group: 'Humanities & Creative Arts',
    items: [
      'BA English', 'BA French', 'BA Graphic Design', 'BA History',
      'BA Linguistics', 'BA Philosophy', 'BA Study of Religions',
      'BA Theatre Arts', 'BFA Fine Arts', 'BMus Music',
    ],
  },
  {
    group: 'Built Environment',
    items: [
      'BSc Architecture', 'BSc Construction Technology and Management',
      'BSc Development Planning', 'BSc Land Economy',
      'BSc Quantity Surveying', 'BSc Real Estate',
    ],
  },
  {
    group: 'Education',
    items: [
      'BEd Basic Education', 'BEd English Education',
      'BEd Mathematics Education', 'BEd Physical Education',
      'BEd Science Education',
    ],
  },
]

export const PROGRAMMES = PROGRAMME_GROUPS.flatMap((g) => g.items)

export const scholarships: Scholarship[] = [
  {
    id: 'sch-getfund',
    name: 'GETFund National Scholarship',
    provider: 'Ghana Education Trust Fund',
    providerType: 'Government',
    logoColor: 'bg-emerald-600',
    initials: 'GF',
    amount: 'Full tuition + GH₵ 6,000 stipend',
    amountValue: 14000,
    deadline: '2026-07-31',
    region: ['All'],
    programmes: ['All'],
    maxAggregate: 12,
    needBased: true,
    slots: 1200,
    applicants: 8420,
    summary:
      'Government-funded award covering full tuition and an annual upkeep stipend for academically qualified, financially needy Ghanaian students in accredited tertiary institutions.',
    benefits: ['Full tuition for the programme duration', 'GH₵ 6,000 annual stipend', 'Book and research allowance', 'Renewable each academic year'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Financial Need Statement'],
    tags: ['Need-based', 'Renewable', 'Nationwide'],
  },
  {
    id: 'sch-mtn',
    name: 'MTN Bright Scholarship',
    provider: 'MTN Ghana Foundation',
    providerType: 'Corporate',
    logoColor: 'bg-amber-500',
    initials: 'MB',
    amount: 'GH₵ 10,000 / year',
    amountValue: 10000,
    deadline: '2026-07-14',
    region: ['All'],
    programmes: ['BSc Computer Engineering', 'BSc Computer Science', 'BSc Electrical Engineering', 'BSc Mathematics', 'BSc Physics'],
    maxAggregate: 10,
    needBased: true,
    slots: 150,
    applicants: 3110,
    summary:
      'Awarded to high-performing students from underserved backgrounds pursuing STEM programmes, with priority on ICT and engineering disciplines.',
    benefits: ['GH₵ 10,000 annual award', 'Paid internship at MTN Ghana', 'Mentorship and career coaching', 'Laptop and data bundle'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Recommendation Letter'],
    tags: ['STEM', 'Mentorship', 'Internship'],
  },
  {
    id: 'sch-mastercard',
    name: 'Mastercard Foundation Scholars',
    provider: 'Mastercard Foundation',
    providerType: 'Foundation',
    logoColor: 'bg-orange-600',
    initials: 'MC',
    amount: 'Comprehensive (full cost)',
    amountValue: 22000,
    deadline: '2026-08-20',
    region: ['All'],
    programmes: ['All'],
    maxAggregate: 14,
    needBased: true,
    slots: 200,
    applicants: 5240,
    summary:
      'A comprehensive scholarship covering tuition, accommodation, meals, books and a monthly stipend, with leadership development for young Africans committed to giving back.',
    benefits: ['Full cost of attendance', 'Accommodation and meals', 'Monthly personal stipend', 'Leadership and entrepreneurship training'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Financial Need Statement', 'Personal Essay'],
    tags: ['Comprehensive', 'Leadership', 'Need-based'],
  },
  {
    id: 'sch-district',
    name: 'District-Level Scholarship Scheme',
    provider: 'Ghana Scholarships Secretariat',
    providerType: 'Government',
    logoColor: 'bg-teal-700',
    initials: 'DS',
    amount: 'GH₵ 4,500 / year',
    amountValue: 4500,
    deadline: '2026-07-05',
    region: ['Ashanti', 'Bono', 'Ahafo', 'Bono East'],
    programmes: ['All'],
    maxAggregate: 15,
    needBased: true,
    slots: 800,
    applicants: 6190,
    summary:
      'Decentralised award administered through the Metropolitan, Municipal and District Assemblies (MMDAs) for indigenes of the district pursuing accredited tertiary programmes.',
    benefits: ['GH₵ 4,500 annual award', 'District-level mentorship', 'Priority for renewal', 'Community service placement'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Proof of District of Origin'],
    tags: ['District', 'Interview required', 'Renewable'],
  },
  {
    id: 'sch-stanbic',
    name: 'Stanbic Bank Future Leaders',
    provider: 'Stanbic Bank Ghana',
    providerType: 'Corporate',
    logoColor: 'bg-blue-700',
    initials: 'SB',
    amount: 'GH₵ 8,000 / year',
    amountValue: 8000,
    deadline: '2026-09-10',
    region: ['All'],
    programmes: ['BA Economics', 'BSc Business Administration', 'BSc Mathematics', 'BSc Computer Science', 'BSc Computer Engineering'],
    maxAggregate: 11,
    needBased: false,
    slots: 60,
    applicants: 1880,
    summary:
      'Merit award for outstanding students in business, finance and analytics disciplines, with a fast-track route into the bank graduate programme.',
    benefits: ['GH₵ 8,000 annual award', 'Graduate scheme fast-track', 'Financial literacy bootcamp', 'Networking with industry leaders'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Statement of Purpose'],
    tags: ['Merit', 'Business', 'Career track'],
  },
  {
    id: 'sch-chevening',
    name: 'Chevening-Ghana Undergraduate Link',
    provider: 'UK Government (FCDO)',
    providerType: 'International',
    logoColor: 'bg-indigo-700',
    initials: 'CV',
    amount: 'GH₵ 18,000 + exchange term',
    amountValue: 18000,
    deadline: '2026-10-01',
    region: ['All'],
    programmes: ['All'],
    maxAggregate: 8,
    needBased: false,
    slots: 25,
    applicants: 2400,
    summary:
      'Highly selective international award offering funding plus a one-term exchange at a partner UK university for exceptional students with leadership potential.',
    benefits: ['GH₵ 18,000 annual award', 'One-term UK exchange', 'Global alumni network', 'Leadership residential'],
    documents: ['Ghana Card', 'WASSCE Results Slip', 'Admission Letter', 'Two Recommendation Letters', 'Leadership Essay'],
    tags: ['International', 'Highly selective', 'Exchange'],
  },
]

// Pre-computed matches for the demo student (aggregate 8, Computer Engineering, Ashanti, high need)
export const matches: MatchResult[] = [
  {
    scholarship: scholarships[1], // MTN
    score: 96,
    status: 'Strong match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 is within the required ≤ 10' },
      { label: 'Programme of study', met: true, detail: 'Computer Engineering is a priority STEM field' },
      { label: 'Region', met: true, detail: 'Open to all 16 regions' },
      { label: 'Financial need', met: true, detail: 'High need level matches the award focus' },
    ],
  },
  {
    scholarship: scholarships[0], // GETFund
    score: 92,
    status: 'Strong match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 is within the required ≤ 12' },
      { label: 'Programme of study', met: true, detail: 'Open to all accredited programmes' },
      { label: 'Region', met: true, detail: 'Nationwide eligibility' },
      { label: 'Financial need', met: true, detail: 'High need level qualifies' },
    ],
  },
  {
    scholarship: scholarships[5], // Chevening
    score: 88,
    status: 'Strong match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 meets the strict ≤ 8 cut-off' },
      { label: 'Programme of study', met: true, detail: 'Open to all programmes' },
      { label: 'Region', met: true, detail: 'Nationwide eligibility' },
      { label: 'Leadership evidence', met: false, detail: 'Add a leadership essay to strengthen this' },
    ],
  },
  {
    scholarship: scholarships[3], // District
    score: 78,
    status: 'Partial match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 is within ≤ 15' },
      { label: 'Region', met: true, detail: 'Ashanti is an eligible district zone' },
      { label: 'Programme of study', met: true, detail: 'Open to all programmes' },
      { label: 'Proof of district origin', met: false, detail: 'Upload proof of Kumasi Metro origin to qualify' },
    ],
  },
  {
    scholarship: scholarships[4], // Stanbic
    score: 71,
    status: 'Partial match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 is within ≤ 11' },
      { label: 'Region', met: true, detail: 'Nationwide eligibility' },
      { label: 'Programme of study', met: false, detail: 'Computer Engineering is borderline; CS / Business preferred' },
      { label: 'Merit threshold', met: true, detail: 'Strong academic standing' },
    ],
  },
  {
    scholarship: scholarships[2], // Mastercard
    score: 90,
    status: 'Strong match',
    criteria: [
      { label: 'WASSCE aggregate', met: true, detail: 'Your aggregate 8 is within ≤ 14' },
      { label: 'Programme of study', met: true, detail: 'Open to all programmes' },
      { label: 'Region', met: true, detail: 'Nationwide eligibility' },
      { label: 'Financial need', met: true, detail: 'High need is the primary criterion' },
    ],
  },
]

export const applications: Application[] = [
  {
    id: 'app-1',
    scholarshipId: 'sch-mtn',
    scholarshipName: 'MTN Bright Scholarship',
    provider: 'MTN Ghana Foundation',
    initials: 'MB',
    logoColor: 'bg-amber-500',
    status: 'Interview',
    submittedOn: '2026-06-12',
    lastUpdate: '2026-06-26',
    progress: 75,
    amount: 'GH₵ 10,000 / year',
    timeline: [
      { label: 'Application submitted', date: '12 Jun 2026', done: true },
      { label: 'Documents verified', date: '18 Jun 2026', done: true },
      { label: 'Shortlisted for interview', date: '26 Jun 2026', done: true },
      { label: 'Interview scheduled', date: '03 Jul 2026', done: false },
      { label: 'Final decision', date: 'Expected 15 Jul', done: false },
    ],
  },
  {
    id: 'app-2',
    scholarshipId: 'sch-getfund',
    scholarshipName: 'GETFund National Scholarship',
    provider: 'Ghana Education Trust Fund',
    initials: 'GF',
    logoColor: 'bg-emerald-600',
    status: 'Under Review',
    submittedOn: '2026-06-20',
    lastUpdate: '2026-06-24',
    progress: 50,
    amount: 'Full tuition + stipend',
    timeline: [
      { label: 'Application submitted', date: '20 Jun 2026', done: true },
      { label: 'Documents verified', date: '24 Jun 2026', done: true },
      { label: 'Eligibility review', date: 'In progress', done: false },
      { label: 'Award decision', date: 'Expected 31 Jul', done: false },
    ],
  },
  {
    id: 'app-3',
    scholarshipId: 'sch-district',
    scholarshipName: 'District-Level Scholarship Scheme',
    provider: 'Ghana Scholarships Secretariat',
    initials: 'DS',
    logoColor: 'bg-teal-700',
    status: 'Submitted',
    submittedOn: '2026-06-28',
    lastUpdate: '2026-06-28',
    progress: 25,
    amount: 'GH₵ 4,500 / year',
    timeline: [
      { label: 'Application submitted', date: '28 Jun 2026', done: true },
      { label: 'Documents verification', date: 'Pending', done: false },
      { label: 'District interview', date: 'To be scheduled', done: false },
      { label: 'Award decision', date: 'Expected 20 Jul', done: false },
    ],
  },
  {
    id: 'app-4',
    scholarshipId: 'sch-mastercard',
    scholarshipName: 'Mastercard Foundation Scholars',
    provider: 'Mastercard Foundation',
    initials: 'MC',
    logoColor: 'bg-orange-600',
    status: 'Draft',
    submittedOn: '—',
    lastUpdate: '2026-06-27',
    progress: 10,
    amount: 'Comprehensive',
    timeline: [
      { label: 'Draft started', date: '27 Jun 2026', done: true },
      { label: 'Personal essay', date: 'Incomplete', done: false },
      { label: 'Submit application', date: 'Due 20 Aug', done: false },
    ],
  },
]

export const documents: VaultDocument[] = [
  { id: 'doc-1', name: 'Ghana Card (Front & Back)', type: 'PDF', category: 'Identity', size: '1.2 MB', uploadedOn: '02 Jun 2026', status: 'Verified', linkedApplications: 4, encrypted: true },
  { id: 'doc-2', name: 'WASSCE Results Slip', type: 'PDF', category: 'Academic', size: '840 KB', uploadedOn: '02 Jun 2026', status: 'Verified', linkedApplications: 4, encrypted: true },
  { id: 'doc-3', name: 'KNUST Admission Letter', type: 'PDF', category: 'Admission', size: '510 KB', uploadedOn: '05 Jun 2026', status: 'Verified', linkedApplications: 3, encrypted: true },
  { id: 'doc-4', name: 'Financial Need Statement', type: 'PDF', category: 'Financial', size: '320 KB', uploadedOn: '11 Jun 2026', status: 'Pending', linkedApplications: 2, encrypted: true },
  { id: 'doc-5', name: 'Recommendation Letter — Mr. Owusu', type: 'PDF', category: 'Other', size: '290 KB', uploadedOn: '14 Jun 2026', status: 'Verified', linkedApplications: 1, encrypted: true },
  { id: 'doc-6', name: 'Proof of District of Origin', type: 'JPG', category: 'Identity', size: '1.8 MB', uploadedOn: '—', status: 'Action needed', linkedApplications: 0, encrypted: true },
]

export const notifications: AppNotification[] = [
  { id: 'n-1', channel: 'SMS', category: 'Interview', title: 'Interview scheduled', body: 'MTN Bright Scholarship interview set for Thu 03 Jul, 10:00 AM at MTN House, Accra. Reply 1 to confirm.', time: '2 hours ago', read: false },
  { id: 'n-2', channel: 'SMS', category: 'Deadline', title: 'Deadline in 6 days', body: 'District-Level Scholarship closes 05 Jul 2026. Your application is submitted; upload Proof of Origin to complete.', time: '5 hours ago', read: false },
  { id: 'n-3', channel: 'Email', category: 'Status', title: 'Documents verified', body: 'Your GETFund National Scholarship documents have passed verification. Eligibility review is now in progress.', time: 'Yesterday', read: false },
  { id: 'n-4', channel: 'System', category: 'Match', title: '3 new strong matches', body: 'We found 3 new scholarships matching your profile after the June criteria update.', time: 'Yesterday', read: true },
  { id: 'n-5', channel: 'Email', category: 'Deadline', title: 'MTN deadline reminder', body: 'MTN Bright Scholarship closes 14 Jul 2026. You have an active application in progress.', time: '2 days ago', read: true },
  { id: 'n-6', channel: 'System', category: 'System', title: 'Profile 92% complete', body: 'Add a leadership essay to unlock eligibility for the Chevening-Ghana Undergraduate Link.', time: '3 days ago', read: true },
]

// ---- Admin demo data ----
export const adminStats = {
  totalScholarships: 48,
  activeApplicants: 12840,
  applicationsThisCycle: 31420,
  awardsDisbursed: 'GH₵ 41.6M',
}

export const applicationsTrend = [
  { month: 'Jan', applications: 1200, matches: 3400 },
  { month: 'Feb', applications: 2100, matches: 5200 },
  { month: 'Mar', applications: 4800, matches: 9100 },
  { month: 'Apr', applications: 6900, matches: 12800 },
  { month: 'May', applications: 5200, matches: 11200 },
  { month: 'Jun', applications: 7400, matches: 14600 },
]

export const regionDistribution = [
  { region: 'Ashanti', value: 4200 },
  { region: 'Greater Accra', value: 3900 },
  { region: 'Northern', value: 1800 },
  { region: 'Eastern', value: 1500 },
  { region: 'Volta', value: 1100 },
  { region: 'Others', value: 2340 },
]

export const adminApplications = [
  { id: 'KN-10293', student: 'Adwoa Mensah', programme: 'BSc Nursing', scholarship: 'GETFund National', aggregate: 7, region: 'Ashanti', status: 'Under Review' },
  { id: 'KN-10294', student: 'Kwame Boateng', programme: 'BSc Computer Science', scholarship: 'MTN Bright', aggregate: 9, region: 'Bono', status: 'Interview' },
  { id: 'KN-10295', student: 'Yaa Asantewaa', programme: 'LLB Law', scholarship: 'Mastercard Foundation', aggregate: 6, region: 'Eastern', status: 'Awarded' },
  { id: 'KN-10296', student: 'Ibrahim Mohammed', programme: 'BSc Agriculture', scholarship: 'District-Level', aggregate: 12, region: 'Northern', status: 'Submitted' },
  { id: 'KN-10297', student: 'Esi Quayson', programme: 'Doctor of Medicine', scholarship: 'Chevening-Ghana', aggregate: 6, region: 'Central', status: 'Under Review' },
  { id: 'KN-10298', student: 'Kojo Antwi', programme: 'BSc Electrical Eng.', scholarship: 'MTN Bright', aggregate: 10, region: 'Western', status: 'Rejected' },
  { id: 'KN-10299', student: 'Akosua Frimpong', programme: 'BSc Business Admin', scholarship: 'Stanbic Future Leaders', aggregate: 8, region: 'Greater Accra', status: 'Interview' },
]

// Infinity = no deadline published, so it can never be "closing soon".
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDeadline(iso: string | null | undefined): string {
  if (!iso) return 'Not stated'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

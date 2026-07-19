export type Provider = 'Government' | 'Corporate' | 'International' | 'Foundation'

// Where a scholarship record came from. 'curated' means the live scrape failed and
// hardcoded fallback data was substituted, so its amount/deadline are unverified.
export type ScholarshipOrigin = 'scraped' | 'seeded' | 'curated'

// Which students an award funds. 'unknown' caps matching at Partial because
// eligibility can't be confirmed.
export type LevelScope =
  | 'shs'
  | 'tertiary_entry'
  | 'tertiary_continuing'
  | 'tertiary_any'
  | 'postgraduate'
  | 'unknown'

export interface StudentProfile {
  phone: string
  student_type: '' | 'SHS' | 'University'
  // SHS track
  shs_school: string
  shs_level: '' | 'Form 1' | 'Form 2' | 'Form 3' | 'Completed'
  wassce_status: '' | 'not_written' | 'awaiting' | 'released'
  // University track
  student_id: string
  programme: string
  institution: string
  university_level: '' | '100' | '200' | '300' | '400' | 'Postgraduate'
  academic_standing: string
  // Shared
  region: string
  home_district: string
  wassce_aggregate: number | null // null = not provided (e.g. awaiting results)
  gender: string
  need_level: 'Low' | 'Moderate' | 'High'
  profile_completion: number
}

export interface Scholarship {
  id: string
  name: string
  origin?: ScholarshipOrigin
  levelScope?: LevelScope
  // The live page this was scraped from, so students can verify and apply at
  // the original listing. Empty for curated fallback rows.
  sourceUrl?: string
  provider: string
  providerType: Provider
  logoColor: string
  initials: string
  amount: string
  amountValue: number
  deadline: string | null // ISO date; null = the provider doesn't state one
  region: string[] // eligible regions, 'All' for nationwide
  programmes: string[] // 'All' for any
  maxAggregate: number // best (lowest) WASSCE aggregate required; lower is stricter
  needBased: boolean
  slots: number
  applicants: number
  summary: string
  benefits: string[]
  documents: string[]
  tags: string[]
}

export interface MatchResult {
  scholarship: Scholarship
  score: number // 0-100
  criteria: { label: string; met: boolean; detail: string }[]
  status: 'Strong match' | 'Partial match' | 'Not eligible'
}

export type ApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Interview'
  | 'Awarded'
  | 'Rejected'

export interface Application {
  id: string
  scholarshipId: string
  scholarshipName: string
  provider: string
  initials: string
  logoColor: string
  status: ApplicationStatus
  submittedOn: string
  lastUpdate: string
  progress: number
  amount: string
  timeline: { label: string; date: string; done: boolean }[]
}

export interface VaultDocument {
  id: string
  name: string
  type: string
  category: 'Identity' | 'Academic' | 'Admission' | 'Financial' | 'Other'
  size: string
  uploadedOn: string
  status: 'Verified' | 'Pending' | 'Action needed'
  linkedApplications: number
  encrypted: boolean
}

export interface AppNotification {
  id: string
  channel: 'SMS' | 'Email' | 'System'
  category: 'Deadline' | 'Status' | 'Interview' | 'Match' | 'System'
  title: string
  body: string
  time: string
  read: boolean
}

export interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  text: string
  quickReplies?: string[]
}

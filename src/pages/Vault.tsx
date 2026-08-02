import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { api } from '../api/endpoints'
import {
  FolderLock,
  ShieldCheck,
  UploadCloud,
  FileText,
  MoreVertical,
  Download,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
} from 'lucide-react'
import { Card, StatusPill, Badge } from '../components/ui'
import { cn } from '../lib/cn'

const categories = ['All', 'Identity', 'Academic', 'Admission', 'Financial', 'Other'] as const

const catColors: Record<string, string> = {
  Identity: 'bg-rose-50 text-rose-600',
  Academic: 'bg-sky-50 text-sky-600',
  Admission: 'bg-violet-50 text-violet-600',
  Financial: 'bg-emerald-50 text-emerald-600',
  Other: 'bg-ink-100 text-ink-500',
}

// The API returns each document's size as a human string ("1.2 MB", "512 KB").
// Parse it back to megabytes so the storage meter reflects real usage.
const STORAGE_QUOTA_MB = 50

function parseSizeToMb(size?: string): number {
  if (!size) return 0
  const m = size.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i)
  if (!m) return 0
  const val = parseFloat(m[1])
  if (!Number.isFinite(val)) return 0
  switch ((m[2] || 'MB').toUpperCase()) {
    case 'B':
      return val / (1024 * 1024)
    case 'KB':
      return val / 1024
    case 'GB':
      return val * 1024
    default:
      return val
  }
}

function formatMb(mb: number): string {
  if (mb <= 0) return '0 MB'
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`
}

// Documents most Ghanaian scholarship applications ask for. Drives the
// readiness checklist so a student can see at a glance what is still missing.
const ESSENTIAL_TYPES = [
  'ghana_card',
  'wassce',
  'transcript',
  'admission_letter',
  'passport_photo',
  'proof_of_residence',
]

type DocType = { key: string; label: string; category: string }

export default function Vault() {
  const [documents, setDocuments] = useState<any[]>([])
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<(typeof categories)[number]>('All')
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Pending upload: the chosen file waits here until the student says what it is.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingType, setPendingType] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [uploadError, setUploadError] = useState('')

  const fetchDocuments = () => {
    api.documents.list().then(setDocuments).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDocuments()
    api.reference()
      .then((r) => setDocTypes(r.documentTypes || []))
      .catch(() => setDocTypes([]))
  }, [])

  const rawId = (id: string) => id.replace('doc-', '')

  const haveType = (key: string) => documents.some((d) => d.docType === key)

  // Open the file picker, remembering which type the student intends it to be.
  const pickFileFor = (typeKey: string) => {
    setPendingType(typeKey)
    fileInputRef.current?.click()
  }

  const handleDelete = async (doc: any) => {
    if (!window.confirm(`Permanently delete “${doc.name}”? This can’t be undone.`)) return
    setMenuFor(null)
    setDeletingId(doc.id)
    try {
      await api.documents.remove(rawId(doc.id))
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Could not delete this document. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }
  
  // Step 1: a file was chosen. Hold it and ask what it is before uploading.
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const file = e.target.files[0]
    setPendingFile(file)
    setPendingName(file.name.replace(/\.[^.]+$/, ''))
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const cancelUpload = () => {
    setPendingFile(null)
    setPendingType('')
    setPendingName('')
    setUploadError('')
  }

  // Step 2: confirmed. Upload with its type so the vault knows which is which.
  const confirmUpload = async () => {
    if (!pendingFile || !pendingType) {
      setUploadError('Please choose what kind of document this is.')
      return
    }
    setIsUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('file', pendingFile)
    formData.append('name', pendingName.trim() || pendingFile.name)
    formData.append('doc_type', pendingType)

    try {
      await api.documents.upload(formData)
      cancelUpload()
      fetchDocuments()
    } catch (err: any) {
      console.error('Upload failed:', err)
      setUploadError(err?.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  if (loading) return <div>Loading vault...</div>

  const essentials = ESSENTIAL_TYPES.map((key) => {
    const t = docTypes.find((d) => d.key === key)
    return { key, label: t?.label || key, have: haveType(key) }
  })
  const readyCount = essentials.filter((e) => e.have).length

  const filtered = documents.filter(
    (d) =>
      (cat === 'All' || d.category === cat) &&
      d.name.toLowerCase().includes(query.toLowerCase()),
  )

  const verified = documents.filter((d) => d.status === 'Verified').length

  const usedMb = documents.reduce((sum, d) => sum + parseSizeToMb(d.size), 0)
  const usedPct = Math.min(100, Math.round((usedMb / STORAGE_QUOTA_MB) * 100))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <FolderLock className="h-5 w-5 text-brand-600" />
          <h1 className="font-display text-2xl font-extrabold text-ink-900">Document Vault</h1>
        </div>
        <p className="text-ink-500">
          Upload once, reuse everywhere. All files are AES-256 encrypted at rest with a full access
          audit trail.
        </p>
      </div>

      {/* Security banner + storage */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4 bg-gradient-to-br from-brand-700 to-brand-900 p-5 text-white lg:col-span-2">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <ShieldCheck className="h-6 w-6 text-gold-300" />
          </div>
          <div className="flex-1">
            <p className="font-display font-bold">End-to-end encrypted storage</p>
            <p className="text-sm text-brand-100">
              {verified} of {documents.length} documents verified · TLS in transit · AES-256 at rest
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="font-display text-2xl font-extrabold text-gold-300">100%</p>
            <p className="text-xs text-brand-200">encrypted</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-700">Storage used</p>
            <span className="text-sm text-ink-400">{formatMb(usedMb)} / {STORAGE_QUOTA_MB} MB</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className={cn('h-full rounded-full transition-all', usedPct >= 90 ? 'bg-rose-500' : 'bg-brand-600')}
              style={{ width: `${usedMb > 0 ? Math.max(2, usedPct) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-400">
            {documents.length === 0
              ? 'Nothing stored yet.'
              : usedPct >= 90
                ? 'Almost full — remove old files to free space.'
                : usedPct >= 60
                  ? `${formatMb(STORAGE_QUOTA_MB - usedMb)} left.`
                  : 'Plenty of room for more documents.'}
          </p>
        </Card>
      </div>

      {/* Upload dropzone */}
      <Card className="border-2 border-dashed border-ink-200 bg-ink-50/50 p-8 text-center transition hover:border-brand-300 hover:bg-brand-50/30">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="mt-3 font-semibold text-ink-800">Drag & drop documents here</p>
        <p className="text-sm text-ink-500">PDF, JPG or PNG up to 10 MB · Ghana Card, WASSCE slip, admission letter</p>
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChosen}
        />
        <button
          disabled={isUploading}
          onClick={() => pickFileFor('')}
          className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-50"
        >
          {isUploading ? 'Encrypting & uploading…' : 'Browse files'}
        </button>
        <p className="mt-2 text-xs text-ink-400">
          You will tag each file so we can attach it automatically when you apply.
        </p>
      </Card>

      {/* Readiness checklist — what applications actually ask for */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">Application readiness</h2>
            <p className="text-sm text-ink-500">
              The documents Ghanaian funders ask for most. Anything here is attached automatically
              when you apply.
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              readyCount === essentials.length
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {readyCount} of {essentials.length} ready
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {essentials.map((e) => (
            <div
              key={e.key}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border p-3',
                e.have ? 'border-emerald-100 bg-emerald-50/50' : 'border-ink-200 bg-white',
              )}
            >
              {e.have ? (
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
              )}
              <span className={cn('flex-1 text-sm', e.have ? 'text-ink-700' : 'text-ink-500')}>
                {e.label}
              </span>
              {!e.have && (
                <button
                  onClick={() => pickFileFor(e.key)}
                  className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Upload
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-sm font-medium transition',
                cat === c
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-56"
          />
        </div>
      </div>

      {/* Doc grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((doc, i) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
          >
            <Card className="group flex h-full flex-col p-5 transition hover:shadow-md hover:shadow-ink-900/5">
              <div className="flex items-start justify-between">
                <div className={cn('grid h-11 w-11 place-items-center rounded-xl', catColors[doc.category])}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="relative flex items-center gap-1">
                  {doc.encrypted && (
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600" title="Encrypted">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <button
                    onClick={() => setMenuFor(menuFor === doc.id ? null : doc.id)}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === doc.id}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-100',
                      menuFor === doc.id ? 'bg-ink-100 opacity-100' : 'opacity-0 group-hover:opacity-100',
                    )}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuFor === doc.id && (
                    <>
                      {/* click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div
                        role="menu"
                        className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg shadow-ink-900/10"
                      >
                        {doc.status !== 'Action needed' && (
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuFor(null)
                              api.documents.download(rawId(doc.id), doc.name)
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink-600 hover:bg-ink-50"
                          >
                            <Download className="h-4 w-4" /> Download
                          </button>
                        )}
                        <button
                          role="menuitem"
                          onClick={() => handleDelete(doc)}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="mt-3 line-clamp-2 font-semibold text-ink-900">{doc.name}</p>
              {doc.docTypeLabel && (
                <p className="mt-1 text-xs font-semibold text-brand-600">{doc.docTypeLabel}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-400">
                <Badge tone="ink">{doc.type}</Badge>
                <span>{doc.size}</span>
              </div>

              <div className="mt-3">
                <StatusPill status={doc.status} />
              </div>

              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-ink-400">
                <span className="inline-flex items-center gap-1.5">
                  {doc.status === 'Verified' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                  {doc.status === 'Pending' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                  {doc.status === 'Action needed' && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                  {doc.uploadedOn === '—' ? 'Not uploaded' : doc.uploadedOn}
                </span>
                {doc.linkedApplications > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5" /> {doc.linkedApplications} app{doc.linkedApplications > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {doc.status === 'Action needed' ? (
                  <button
                    onClick={() => pickFileFor(doc.docType || '')}
                    className="flex-1 rounded-lg bg-brand-700 py-2 text-xs font-semibold text-white hover:bg-brand-800"
                  >
                    Upload now
                  </button>
                ) : (
                  <button
                    onClick={() => api.documents.download(rawId(doc.id), doc.name)}
                    disabled={deletingId === doc.id}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" /> {deletingId === doc.id ? 'Deleting…' : 'Download'}
                  </button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <Card className="p-12 text-center sm:col-span-2 lg:col-span-3">
            {documents.length === 0 ? (
              <>
                <UploadCloud className="mx-auto h-10 w-10 text-ink-300" />
                <p className="mt-3 font-semibold text-ink-700">Your vault is empty</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
                  Upload your Ghana Card, WASSCE slip or admission letter once and reuse it across
                  every application.
                </p>
                <button
                  onClick={() => pickFileFor('')}
                  className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Upload your first document
                </button>
              </>
            ) : (
              <>
                <Search className="mx-auto h-10 w-10 text-ink-300" />
                <p className="mt-3 font-semibold text-ink-700">No documents match</p>
                <p className="text-sm text-ink-500">Try a different category or clear your search.</p>
              </>
            )}
          </Card>
        )}
      </div>

      {/* "What is this document?" — the step that makes the vault smart */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => !isUploading && cancelUpload()} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-ink-200/70 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-ink-900">What is this document?</h3>
              <p className="mt-0.5 text-sm text-ink-500">
                Tagging it lets us attach it automatically to every application that asks for it.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3">
                <FileText className="h-5 w-5 shrink-0 text-ink-400" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{pendingFile.name}</span>
                <span className="shrink-0 text-xs text-ink-400">
                  {formatMb(pendingFile.size / (1024 * 1024))}
                </span>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-600">Document type *</span>
                <select
                  value={pendingType}
                  onChange={(e) => setPendingType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Select what this document is…</option>
                  {docTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-600">Label (optional)</span>
                <input
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  placeholder="e.g. Ghana Card (front)"
                  className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </label>

              {pendingType && haveType(pendingType) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  You already have a document of this type. Uploading another is fine, we will use
                  the best match when you apply.
                </p>
              )}

              {uploadError && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{uploadError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={cancelUpload}
                  disabled={isUploading}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={isUploading || !pendingType}
                  className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {isUploading ? 'Encrypting & uploading…' : 'Upload securely'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

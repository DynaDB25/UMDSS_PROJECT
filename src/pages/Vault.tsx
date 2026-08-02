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
  Check,
  Link2,
  Plus,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FilterChip,
  Input,
  Modal,
  Select,
  StatusPill,
} from '../components/ui'
import { CardGridSkeleton } from '../components/skeletons'
import { cn } from '../lib/cn'
import { listItem, stagger } from '../lib/motion'

const categories = ['All', 'Identity', 'Academic', 'Admission', 'Financial', 'Other'] as const

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
  const [pendingDelete, setPendingDelete] = useState<any | null>(null)
  const [actionError, setActionError] = useState('')

  // Pending upload: the chosen file waits here until the student says what it is.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingType, setPendingType] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [uploadError, setUploadError] = useState('')

  const fetchDocuments = () => {
    api.documents
      .list()
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDocuments()
    api
      .reference()
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

  const confirmDelete = async () => {
    const doc = pendingDelete
    if (!doc) return
    setMenuFor(null)
    setDeletingId(doc.id)
    setActionError('')
    try {
      await api.documents.remove(rawId(doc.id))
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      setPendingDelete(null)
    } catch (err) {
      console.error('Delete failed:', err)
      setActionError('Could not delete this document. Please try again.')
      setPendingDelete(null)
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

  if (loading) return <CardGridSkeleton />

  const essentials = ESSENTIAL_TYPES.map((key) => {
    const t = docTypes.find((d) => d.key === key)
    return { key, label: t?.label || key, have: haveType(key) }
  })
  const readyCount = essentials.filter((e) => e.have).length

  const filtered = documents.filter(
    (d) => (cat === 'All' || d.category === cat) && d.name.toLowerCase().includes(query.toLowerCase()),
  )

  const verified = documents.filter((d) => d.status === 'Verified').length
  const usedMb = documents.reduce((sum, d) => sum + parseSizeToMb(d.size), 0)
  const usedPct = Math.min(100, Math.round((usedMb / STORAGE_QUOTA_MB) * 100))

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <p className="t-overline text-accent">Secure storage</p>
          <h1 className="t-h1 mt-2 text-ink">Document vault</h1>
          <p className="t-body mt-2 max-w-prose text-ink-muted">
            Upload once, reuse everywhere. Every file is AES-256 encrypted at rest with a full
            access audit trail.
          </p>
        </div>
        <Button
          variant="accent"
          onClick={() => pickFileFor('')}
          disabled={isUploading}
          icon={<Plus className="h-4 w-4" />}
          className="w-full justify-center sm:w-auto"
        >
          Upload document
        </Button>
      </header>

      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChosen} />

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {/* Encryption + storage */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-md bg-band px-5 py-5 lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-band-rule text-accent">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold tracking-tight text-band-on">
                End-to-end encrypted storage
              </p>
              <p className="t-sm mt-1 text-band-muted">
                <span className="tabular">{verified}</span> of{' '}
                <span className="tabular">{documents.length}</span> documents verified · TLS in
                transit · AES-256 at rest
              </p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="tabular font-display text-2xl font-extrabold tracking-tight text-accent">
                100%
              </p>
              <p className="t-overline text-band-muted">encrypted</p>
            </div>
          </div>
        </section>

        <Card className="px-5 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-overline text-ink-muted">Storage used</p>
            <span className="tabular t-sm font-semibold text-ink">
              {formatMb(usedMb)} / {STORAGE_QUOTA_MB} MB
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500 ease-brand',
                usedPct >= 90 ? 'bg-state-negative' : 'bg-accent',
              )}
              style={{ width: `${usedMb > 0 ? Math.max(2, usedPct) : 0}%` }}
            />
          </div>
          <p className="t-xs mt-2.5 text-ink-muted">
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

      {/* Readiness checklist — what applications actually ask for */}
      <Card as="section">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule px-5 py-4">
          <div className="min-w-0">
            <h2 className="t-h3 text-ink">Application readiness</h2>
            <p className="t-sm mt-1 max-w-prose text-ink-muted">
              The documents Ghanaian funders ask for most. Anything here attaches automatically when
              you apply.
            </p>
          </div>
          <span
            className={cn(
              'tabular shrink-0 rounded-full border px-3 py-1 text-[0.6875rem] font-bold',
              readyCount === essentials.length
                ? 'border-state-positive/40 text-state-positive'
                : 'border-state-attention/40 text-state-attention',
            )}
          >
            {readyCount} of {essentials.length} ready
          </span>
        </div>

        <ul className="rule-list">
          {essentials.map((e) => (
            <li key={e.key} className="flex items-center gap-3 px-5 py-3">
              <span
                className={cn(
                  'grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border',
                  e.have
                    ? 'border-state-positive bg-state-positive text-white'
                    : 'border-rule-strong text-transparent',
                )}
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={cn('t-sm min-w-0 flex-1', e.have ? 'text-ink' : 'text-ink-muted')}>
                {e.label}
              </span>
              {!e.have && (
                <Button size="sm" variant="subtle" onClick={() => pickFileFor(e.key)} className="shrink-0">
                  Upload
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </FilterChip>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents…"
          aria-label="Search documents"
          inputSize="sm"
          icon={<Search />}
          className="sm:w-56"
        />
      </div>

      {/* Documents */}
      {filtered.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger(0, 0.04)}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((doc) => (
            <motion.div key={doc.id} variants={listItem}>
              <Card className="group flex h-full flex-col p-5 transition-colors hover:border-rule-strong">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-rule text-ink-secondary"
                    aria-hidden
                  >
                    <FileText className="h-4.5 w-4.5" />
                  </span>
                  <div className="relative flex items-center gap-1">
                    {doc.encrypted && (
                      <span
                        className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint"
                        title="Encrypted at rest"
                      >
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setMenuFor(menuFor === doc.id ? null : doc.id)}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === doc.id}
                      aria-label={`Actions for ${doc.name}`}
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-sm text-ink-muted transition hover:bg-surface-sunken hover:text-ink',
                        menuFor === doc.id
                          ? 'bg-surface-sunken opacity-100'
                          : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
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
                          className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-md border border-rule bg-surface py-1 shadow-overlay"
                        >
                          {doc.status !== 'Action needed' && (
                            <button
                              role="menuitem"
                              onClick={() => {
                                setMenuFor(null)
                                api.documents.download(rawId(doc.id), doc.name)
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
                            >
                              <Download className="h-4 w-4" /> Download
                            </button>
                          )}
                          <button
                            role="menuitem"
                            onClick={() => {
                              setMenuFor(null)
                              setPendingDelete(doc)
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-state-negative transition-colors hover:bg-state-negative-soft"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <p className="mt-3.5 line-clamp-2 font-display text-[0.9375rem] font-bold tracking-tight text-ink">
                  {doc.name}
                </p>
                {doc.docTypeLabel && (
                  <p className="t-xs mt-1 font-semibold text-ink-muted">{doc.docTypeLabel}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="ink">{doc.type}</Badge>
                  <span className="tabular t-xs text-ink-muted">{doc.size}</span>
                  <StatusPill status={doc.status} />
                </div>

                <div className="t-xs mt-auto flex items-center justify-between gap-3 pt-4 text-ink-muted">
                  <span className="tabular truncate">
                    {doc.uploadedOn === '—' ? 'Not uploaded' : doc.uploadedOn}
                  </span>
                  {doc.linkedApplications > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Link2 className="h-3.5 w-3.5" aria-hidden /> {doc.linkedApplications} app
                      {doc.linkedApplications > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  {doc.status === 'Action needed' ? (
                    <Button size="sm" variant="accent" block onClick={() => pickFileFor(doc.docType || '')}>
                      Upload now
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="subtle"
                      block
                      loading={deletingId === doc.id}
                      onClick={() => api.documents.download(rawId(doc.id), doc.name)}
                      icon={<Download className="h-3.5 w-3.5" />}
                    >
                      Download
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<UploadCloud />}
          title="Your vault is empty"
          description="Upload your Ghana Card, WASSCE slip or admission letter once and reuse it across every application."
          action={
            <Button variant="accent" onClick={() => pickFileFor('')}>
              Upload your first document
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<Search />}
          title="No documents match"
          description="Try a different category, or clear your search."
          action={
            <button
              type="button"
              onClick={() => {
                setCat('All')
                setQuery('')
              }}
              className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-accent"
            >
              Clear filters
            </button>
          }
        />
      )}

      <p className="t-xs flex items-center justify-center gap-2 text-ink-muted">
        <FolderLock className="h-3.5 w-3.5 text-accent" aria-hidden />
        Only you can open these files. ScholarCircle staff never see their contents.
      </p>

      {/* "What is this document?" — the step that makes the vault smart */}
      <Modal
        open={!!pendingFile}
        onClose={() => !isUploading && cancelUpload()}
        title="What is this document?"
        description="Tagging it lets us attach it automatically to every application that asks for it."
        footer={
          <>
            <Button variant="subtle" onClick={cancelUpload} disabled={isUploading} block className="sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={confirmUpload}
              loading={isUploading}
              disabled={!pendingType}
              block
              className="sm:w-auto"
            >
              Upload securely
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {pendingFile && (
            <div className="flex items-center gap-3 rounded-md border border-rule bg-surface-sunken p-3">
              <FileText className="h-4.5 w-4.5 shrink-0 text-ink-muted" aria-hidden />
              <span className="t-sm min-w-0 flex-1 truncate text-ink">{pendingFile.name}</span>
              <span className="tabular t-xs shrink-0 text-ink-muted">
                {formatMb(pendingFile.size / (1024 * 1024))}
              </span>
            </div>
          )}

          <Field label="Document type" htmlFor="vault-type" required>
            <Select
              id="vault-type"
              data-autofocus
              value={pendingType}
              onChange={(e) => setPendingType(e.target.value)}
            >
              <option value="">Select what this document is…</option>
              {docTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Label" htmlFor="vault-label" hint="Optional — helps you tell copies apart.">
            <Input
              id="vault-label"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder="e.g. Ghana Card (front)"
            />
          </Field>

          {pendingType && haveType(pendingType) && (
            <Alert tone="warning">
              You already have a document of this type. Uploading another is fine — we use the best
              match when you apply.
            </Alert>
          )}

          {uploadError && <Alert tone="danger">{uploadError}</Alert>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Delete this document?"
        confirmLabel="Delete permanently"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed from your vault and detached from any application using it. This cannot be undone.`
            : ''
        }
      />
    </div>
  )
}

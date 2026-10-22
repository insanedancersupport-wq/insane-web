import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { EmptyState } from '../../components/feedback/EmptyState'
import { ErrorState } from '../../components/feedback/ErrorState'
import { LoadingState } from '../../components/feedback/LoadingState'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dialog } from '../../components/ui/Dialog'
import { Input } from '../../components/ui/Input'
import {
  deleteCompetitionResult,
  getCompetitionResultMembers,
  getCompetitionResults,
  saveCompetitionResult,
} from './competitionsApi'

const resultSchema = z.object({
  award: z.string(),
  category: z.string().trim().min(1, 'Category is required.'),
  member_ids: z.array(z.string()),
  notes: z.string(),
  placement: z.preprocess(
    (value) => (value === '' ? null : Number(value)),
    z.number().int('Placement must be a whole number.').positive('Placement must be positive.').nullable(),
  ),
  result_type: z.enum(['individual', 'team']),
  team_name: z.string(),
}).superRefine((values, context) => {
  if (values.result_type === 'individual' && values.member_ids.length !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Individual results require exactly one student.',
      path: ['member_ids'],
    })
  }

  if (values.result_type === 'team' && values.member_ids.length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Team results require at least two students.',
      path: ['member_ids'],
    })
  }
})

function resultMembersById(members) {
  return members.reduce((byResult, member) => {
    const current = byResult.get(member.result_id) ?? []
    current.push(member)
    byResult.set(member.result_id, current)
    return byResult
  }, new Map())
}

function sortedResults(results) {
  return [...results].sort((left, right) => {
    const categoryComparison = left.category.localeCompare(right.category)
    if (categoryComparison !== 0) return categoryComparison

    if (left.placement === null && right.placement !== null) return 1
    if (left.placement !== null && right.placement === null) return -1
    if (left.placement !== right.placement) return (left.placement ?? 0) - (right.placement ?? 0)

    return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)
  })
}

function resultTitle(result, members) {
  if (result.result_type === 'team') {
    return result.team_name || 'Team result'
  }

  const member = members[0]
  return member ? `${member.first_name} ${member.last_name}` : 'Member display data is unavailable'
}

function ResultForm({ onSubmit, participants, result, saving }) {
  const [memberSearch, setMemberSearch] = useState('')
  const defaultValues = {
    award: result?.award ?? '',
    category: result?.category ?? '',
    member_ids: result?.memberIds ?? [],
    notes: result?.notes ?? '',
    placement: result?.placement ?? '',
    result_type: result?.result_type ?? 'individual',
    team_name: result?.team_name ?? '',
  }
  const { formState: { errors }, handleSubmit, register, setValue, watch } = useForm({
    defaultValues,
    resolver: zodResolver(resultSchema),
  })
  const resultType = watch('result_type')
  const memberIds = watch('member_ids')
  const matchingParticipants = participants.filter((participant) => (
    `${participant.first_name} ${participant.last_name}`.toLowerCase().includes(memberSearch.trim().toLowerCase())
  ))

  function toggleTeamMember(studentId) {
    const next = memberIds.includes(studentId)
      ? memberIds.filter((id) => id !== studentId)
      : [...memberIds, studentId]
    setValue('member_ids', next, { shouldValidate: true })
  }

  return (
    <form className="entity-form" id="competition-result-form" onSubmit={handleSubmit(onSubmit)}>
      <label className="field" htmlFor="result-type">
        <span className="field__label">Result type</span>
        <select className="field__input" id="result-type" {...register('result_type')}>
          <option value="individual">Individual</option>
          <option value="team">Team</option>
        </select>
      </label>
      <Input label="Category" {...register('category')} />
      {errors.category && <p className="form-error" role="alert">{errors.category.message}</p>}
      {resultType === 'team' && <Input label="Team name (optional)" {...register('team_name')} />}
      <Input label="Placement (optional)" min="1" type="number" {...register('placement')} />
      {errors.placement && <p className="form-error" role="alert">{errors.placement.message}</p>}
      <Input label="Award (optional)" {...register('award')} />
      <label className="field" htmlFor="result-notes">
        <span className="field__label">Notes</span>
        <textarea className="field__input field__textarea" id="result-notes" {...register('notes')} />
      </label>
      <fieldset className="assignment-list">
        <legend>Members ({memberIds.length} selected)</legend>
        <Input label="Search enrolled students" onChange={(event) => setMemberSearch(event.target.value)} value={memberSearch} />
        {resultType === 'individual' && memberIds.length > 1 && (
          <p className="form-error" role="alert">Choose exactly one student for this individual result.</p>
        )}
        {matchingParticipants.map((participant) => {
          const selected = memberIds.includes(participant.student_id)
          const label = `${participant.first_name} ${participant.last_name}`
          return (
            <label className="assignment-option" key={participant.student_id}>
              <input
                checked={selected && (resultType === 'team' || memberIds.length === 1)}
                name="result-member"
                onChange={() => {
                  if (resultType === 'individual') {
                    setValue('member_ids', [participant.student_id], { shouldValidate: true })
                  } else {
                    toggleTeamMember(participant.student_id)
                  }
                }}
                type={resultType === 'individual' ? 'radio' : 'checkbox'}
              />
              {label}
            </label>
          )
        })}
        {matchingParticipants.length === 0 && <p>No enrolled students match this search.</p>}
      </fieldset>
      {errors.member_ids && <p className="form-error" role="alert">{errors.member_ids.message}</p>}
      {saving && <LoadingState label="Saving result" />}
    </form>
  )
}

export function CompetitionResultsSection({ canManage, competitionId, participants }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [editingResult, setEditingResult] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const resultsQuery = useQuery({
    queryKey: ['competition-results', competitionId],
    queryFn: () => getCompetitionResults(competitionId),
  })
  const membersQuery = useQuery({
    queryKey: ['competition-result-members', competitionId],
    queryFn: () => getCompetitionResultMembers(competitionId),
  })
  const invalidateResults = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['competition-results', competitionId] }),
      queryClient.invalidateQueries({ queryKey: ['competition-result-members', competitionId] }),
    ])
  }
  const saveMutation = useMutation({
    mutationFn: saveCompetitionResult,
    onSuccess: async () => {
      await invalidateResults()
      setDialog(null)
      setEditingResult(null)
      setFeedback('Competition result saved.')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteCompetitionResult,
    onSuccess: async () => {
      await invalidateResults()
      setDialog(null)
      setEditingResult(null)
      setFeedback('Competition result deleted. Students and competition enrollments were not changed.')
    },
  })
  const membersByResult = useMemo(() => resultMembersById(membersQuery.data ?? []), [membersQuery.data])
  const visibleResults = useMemo(() => sortedResults((resultsQuery.data ?? []).filter((result) => (
    (typeFilter === 'all' || result.result_type === typeFilter)
    && (!search.trim() || result.category.toLowerCase().includes(search.trim().toLowerCase()))
  ))), [resultsQuery.data, search, typeFilter])

  function openNewResult() {
    setError('')
    setEditingResult(null)
    setDialog('form')
  }

  function openEditResult(result) {
    setError('')
    setEditingResult({
      ...result,
      memberIds: (membersByResult.get(result.id) ?? []).map((member) => member.student_id),
    })
    setDialog('form')
  }

  async function saveResult(values) {
    setError('')
    try {
      await saveMutation.mutateAsync({
        award: values.award,
        category: values.category,
        competitionId,
        notes: values.notes,
        placement: values.placement,
        resultId: editingResult?.id ?? null,
        resultType: values.result_type,
        studentIds: values.member_ids,
        teamName: values.team_name,
      })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function deleteResult() {
    setError('')
    try {
      await deleteMutation.mutateAsync(editingResult.id)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  function closeDialog() {
    if (!saveMutation.isPending && !deleteMutation.isPending) {
      setDialog(null)
      setEditingResult(null)
    }
  }

  return (
    <Card className="detail-card competition-detail-grid__wide">
      <div className="competition-section-heading">
        <div><h3>Results</h3><p>Results use the explicitly recorded participating students.</p></div>
        {canManage && <Button disabled={participants.length === 0} onClick={openNewResult} variant="secondary">Add result</Button>}
      </div>
      {canManage && participants.length === 0 && <p>Enroll students in Participants before recording a result.</p>}
      {feedback && <p className="success-message" role="status">{feedback}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {resultsQuery.isLoading && <LoadingState label="Loading competition results" />}
      {resultsQuery.error && <ErrorState title="Unable to load competition results" />}
      {membersQuery.error && !resultsQuery.error && <ErrorState title="Unable to load competition result members" />}
      {resultsQuery.data?.length === 0 && !resultsQuery.error && <EmptyState description="No results have been recorded for this competition." title="No results yet" />}
      {resultsQuery.data?.length > 0 && (
        <>
          <section aria-label="Result filters" className="list-filters competition-result-filters">
            <Input label="Search categories" onChange={(event) => setSearch(event.target.value)} value={search} />
            <label className="field" htmlFor="result-type-filter">
              <span className="field__label">Result type</span>
              <select className="field__input" id="result-type-filter" onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}>
                <option value="all">All result types</option>
                <option value="individual">Individual</option>
                <option value="team">Team</option>
              </select>
            </label>
          </section>
          {visibleResults.length === 0 && <EmptyState description="Adjust the result filters to see matching records." title="No matching results" />}
          <section aria-label="Competition results" className="competition-results-list">
            {visibleResults.map((result) => {
              const members = membersByResult.get(result.id) ?? []
              return (
                <article className="competition-result" key={result.id}>
                  <div>
                    <h4>{result.category}</h4>
                    <p>{resultTitle(result, members)}</p>
                    <div className="competition-result__badges">
                      <Badge tone={result.result_type === 'team' ? 'warning' : 'success'}>{result.result_type}</Badge>
                      <Badge>{result.placement ? `${result.placement}${result.placement === 1 ? 'st' : result.placement === 2 ? 'nd' : result.placement === 3 ? 'rd' : 'th'} place` : 'Participation'}</Badge>
                    </div>
                    {result.award && <p>Award: {result.award}</p>}
                    {result.notes && <p>{result.notes}</p>}
                    {membersQuery.isLoading && <LoadingState label="Loading result members" />}
                    {!membersQuery.isLoading && members.length > 0 && <p>Members: {members.map((member) => `${member.first_name} ${member.last_name}`).join(', ')}</p>}
                    {!membersQuery.isLoading && !membersQuery.error && members.length === 0 && <p className="form-error">Member display data is unavailable for this result.</p>}
                  </div>
                  {canManage && (
                    <div className="entity-row__actions">
                      <Button onClick={() => openEditResult(result)} variant="secondary">Edit result</Button>
                      <Button onClick={() => {
                        setEditingResult(result)
                        setDialog('delete')
                      }} variant="tertiary">Delete result</Button>
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        </>
      )}
      <Dialog
        footer={(
          <div className="form-actions">
            <Button disabled={saveMutation.isPending || participants.length === 0} form="competition-result-form" type="submit">
              {saveMutation.isPending ? 'Saving...' : 'Save result'}
            </Button>
            <Button disabled={saveMutation.isPending} onClick={closeDialog} variant="tertiary">Cancel</Button>
          </div>
        )}
        onClose={closeDialog}
        open={dialog === 'form'}
        scrollable
        title={editingResult ? 'Edit result' : 'Add result'}
      >
        {participants.length === 0 ? (
          <p>Enroll students in Participants before recording a result.</p>
        ) : (
          <ResultForm
            key={editingResult?.id ?? 'new'}
            onSubmit={saveResult}
            participants={participants}
            result={editingResult}
            saving={saveMutation.isPending}
          />
        )}
      </Dialog>
      <Dialog onClose={closeDialog} open={dialog === 'delete'} title="Delete result">
        <form className="entity-form" onSubmit={(event) => {
          event.preventDefault()
          void deleteResult()
        }}>
          <p>
            Delete {editingResult?.category} for {editingResult && resultTitle(editingResult, membersByResult.get(editingResult.id) ?? [])}?
            This does not remove students or competition enrollments.
          </p>
          <div className="form-actions">
            <Button disabled={deleteMutation.isPending} type="submit">
              {deleteMutation.isPending ? 'Deleting...' : 'Delete result'}
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={closeDialog} variant="tertiary">Cancel</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  )
}

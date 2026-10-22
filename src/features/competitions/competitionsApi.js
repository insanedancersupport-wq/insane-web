import { supabase } from '../../services/supabaseClient'

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function throwOnError(error, message) {
  if (error) {
    throw new Error(message)
  }
}

function requireId(id, entity) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error(`A valid ${entity} ID is required.`)
  }
}

function requireAffectedRow(data, message) {
  if (!data || data.length === 0) {
    throw new Error(message)
  }
}

const competitionFields = 'id, name, competition_date, location, description, status, created_by, created_at, updated_at'
const competitionListFields = `
  ${competitionFields},
  competition_groups(group_id),
  competition_participants(id),
  competition_trainers(trainer_id)
`

export async function getCompetitions() {
  const { data, error } = await client().from('competitions').select(competitionListFields)
  throwOnError(error, 'Unable to load competitions.')
  return data
}

export async function getCompetitionById(competitionId) {
  requireId(competitionId, 'competition')
  const { data, error } = await client().from('competitions').select(competitionFields)
    .eq('id', competitionId).single()
  throwOnError(error, 'Unable to load this competition.')
  return data
}

export async function createCompetition(values) {
  const { data, error } = await client().from('competitions').insert(values).select('id').single()
  throwOnError(error, 'Unable to create the competition.')
  return data
}

export async function updateCompetition({ id, values }) {
  requireId(id, 'competition')
  const { error } = await client().from('competitions').update(values).eq('id', id)
  throwOnError(error, 'Unable to update the competition.')
}

export async function deleteCompetition(id) {
  requireId(id, 'competition')
  const { data, error } = await client().from('competitions').delete().eq('id', id).select('id')
  throwOnError(error, 'Unable to delete the competition. Remove all participants before deleting it.')
  requireAffectedRow(data, 'This competition was not deleted. It may have changed or you no longer have permission.')
  return data[0]
}

export async function getCompetitionTrainers(competitionId) {
  requireId(competitionId, 'competition')
  const { data, error } = await client().rpc('get_competition_trainer_display', {
    target_competition_id: competitionId,
  })
  throwOnError(error, 'Unable to load responsible trainers.')
  return data
}

export async function addCompetitionTrainer({ competitionId, trainerId }) {
  const { error } = await client().from('competition_trainers').insert({
    competition_id: competitionId,
    trainer_id: trainerId,
  })
  throwOnError(error, 'Unable to assign this responsible trainer. They may already be assigned.')
}

export async function removeCompetitionTrainer({ competitionId, trainerId }) {
  const { data, error } = await client().from('competition_trainers').delete()
    .eq('competition_id', competitionId).eq('trainer_id', trainerId).select('trainer_id')
  throwOnError(error, 'Unable to remove this responsible trainer.')
  requireAffectedRow(data, 'This responsible trainer was not removed. It may have changed or you no longer have permission.')
}

export async function getCompetitionGroups(competitionId) {
  requireId(competitionId, 'competition')
  const { data, error } = await client().rpc('get_competition_group_display', {
    target_competition_id: competitionId,
  })
  throwOnError(error, 'Unable to load participating groups.')
  return data
}

export async function addCompetitionGroup({ competitionId, groupId }) {
  const { error } = await client().from('competition_groups').insert({
    competition_id: competitionId,
    group_id: groupId,
  })
  throwOnError(error, 'Unable to add this group. It may already be associated with the competition.')
}

export async function removeCompetitionGroup({ competitionId, groupId }) {
  const { data, error } = await client().from('competition_groups').delete()
    .eq('competition_id', competitionId).eq('group_id', groupId).select('group_id')
  throwOnError(error, 'Unable to remove this group.')
  requireAffectedRow(data, 'This group was not removed. It may have changed or you no longer have permission.')
}

export async function getCompetitionParticipants(competitionId) {
  requireId(competitionId, 'competition')
  const { data, error } = await client().rpc('get_competition_participant_display', {
    target_competition_id: competitionId,
  })
  throwOnError(error, 'Unable to load participants.')
  return data
}

export async function getCurrentTrainerId(profileId) {
  requireId(profileId, 'profile')
  const { data, error } = await client().from('trainers').select('id').eq('profile_id', profileId).maybeSingle()
  throwOnError(error, 'Unable to load your trainer identity.')
  return data?.id ?? null
}

export async function addCompetitionParticipant({ competitionId, studentId }) {
  const { error } = await client().from('competition_participants').insert({
    competition_id: competitionId,
    student_id: studentId,
  })
  throwOnError(error, 'Unable to enroll this student. They must be active and not already registered.')
}

export async function removeCompetitionParticipant({ competitionId, participantId }) {
  const { data, error } = await client().from('competition_participants').delete()
    .eq('competition_id', competitionId).eq('id', participantId).select('id')
  throwOnError(error, 'Unable to remove this participant.')
  requireAffectedRow(data, 'This participant was not removed. It may have changed or you no longer have permission.')
}

export async function enrollCompetitionGroup({ competitionId, groupId }) {
  const { data, error } = await client().rpc('enroll_competition_group', {
    target_competition_id: competitionId,
    target_group_id: groupId,
  })
  throwOnError(error, 'Unable to enroll students from this group.')
  return data
}

export async function getEligibleTrainers() {
  const { data, error } = await client().from('trainers')
    .select('id, profile_id, first_name, last_name, active')
    .eq('active', true)
    .order('last_name').order('first_name')
  throwOnError(error, 'Unable to load eligible trainers.')
  return data
}

export async function getEligibleStudents() {
  const { data, error } = await client().from('students')
    .select('id, first_name, last_name, status')
    .eq('status', 'active')
    .order('last_name').order('first_name')
  throwOnError(error, 'Unable to load eligible students.')
  return data
}

export async function getAvailableGroups() {
  const { data, error } = await client().from('groups')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
  throwOnError(error, 'Unable to load available groups.')
  return data
}

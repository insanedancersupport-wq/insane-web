export function hasInvitationProvenance(user) {
  return typeof user?.invited_at === 'string' && user.invited_at.trim() !== ''
}

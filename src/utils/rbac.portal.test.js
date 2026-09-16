import test from 'node:test';
import assert from 'node:assert/strict';
import { getPortalKey, isUserAllowedInPortal, isValidPortalLogin } from './rbac.js';

test('owner portal only allows owner paths', () => {
  const user = { loginType: 'owner', role: 'Gym Owner' };

  assert.equal(getPortalKey(user), 'gym_owner');
  assert.equal(isUserAllowedInPortal(user, '/members'), true);
  assert.equal(isUserAllowedInPortal(user, '/plans'), true);
  assert.equal(isUserAllowedInPortal(user, '/platform/gyms'), false);
  assert.equal(isValidPortalLogin('owner', user), true);
  assert.equal(isValidPortalLogin('owner', { user: { roles: ['member'] } }), false);
  assert.equal(isValidPortalLogin('owner', { roles: ['owner'] }), true);
  assert.equal(isValidPortalLogin('owner', {}), false);
});

test('staff portal blocks outside portal routes', () => {
  const user = { loginType: 'staff', role: 'Staff' };

  assert.equal(getPortalKey(user), 'staff');
  assert.equal(isUserAllowedInPortal(user, '/members'), true);
  assert.equal(isUserAllowedInPortal(user, '/profile'), true);
  assert.equal(isUserAllowedInPortal(user, '/platform/saas-plans'), false);
  assert.equal(isUserAllowedInPortal(user, '/modules/nutrition'), true);
  assert.equal(isValidPortalLogin('staff', user), true);
  assert.equal(isValidPortalLogin('staff', { role: 'Member' }), false);
  assert.equal(isValidPortalLogin('staff', { userType: 'MEMBER' }), false);
  assert.equal(isValidPortalLogin('staff', { roles: ['trainer'] }), true);
});

test('member portal restricts to member areas', () => {
  const user = { loginType: 'member', role: 'Member' };

  assert.equal(getPortalKey(user), 'member');
  assert.equal(isUserAllowedInPortal(user, '/'), true);
  assert.equal(isUserAllowedInPortal(user, '/plans'), true);
  assert.equal(isUserAllowedInPortal(user, '/members'), false);
  assert.equal(isUserAllowedInPortal(user, '/trainers'), false);
  assert.equal(isUserAllowedInPortal(user, '/profile'), true);
  assert.equal(isValidPortalLogin('member', user), true);
  assert.equal(isValidPortalLogin('member', { role: 'Gym Owner' }), false);
  assert.equal(isValidPortalLogin('member', { userType: 'OWNER' }), false);
  assert.equal(isValidPortalLogin('member', { user: { roles: ['member'] } }), true);
});

test('platform admin portal keeps platform routes isolated', () => {
  const user = { loginType: 'platform', role: 'Platform Admin' };

  assert.equal(getPortalKey(user), 'platform_admin');
  assert.equal(isUserAllowedInPortal(user, '/platform/gyms'), true);
  assert.equal(isUserAllowedInPortal(user, '/platform/saas-plans'), true);
  assert.equal(isUserAllowedInPortal(user, '/'), false);
  assert.equal(isUserAllowedInPortal(user, '/members'), false);
  assert.equal(isValidPortalLogin('platform', user), true);
  assert.equal(isValidPortalLogin('platform', { role: ['SUPER_ADMIN'] }), true);
  assert.equal(isValidPortalLogin('platform', { role: 'Gym Owner' }), false);
  assert.equal(isValidPortalLogin('platform', { user: { roles: ['member'] } }), false);
  assert.equal(isValidPortalLogin('platform', {}), false);
});

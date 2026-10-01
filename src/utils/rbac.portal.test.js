import test from 'node:test';
import assert from 'node:assert/strict';
import { getPortalHomePath, getPortalKey, getPrimaryRole, isUserAllowedInPortal, isValidPortalLogin } from './rbac.js';

test('backend roles determine the highest priority dashboard', () => {
  const user = { roles: ['member', 'trainer', 'owner'], email: 'owner@example.com' };

  assert.equal(getPrimaryRole(user), 'gym_owner');
  assert.equal(getPortalKey(user), 'gym_owner');
  assert.equal(getPortalHomePath(user), '/owner');
});

test('unsupported or missing backend roles have no dashboard', () => {
  assert.equal(getPrimaryRole({ roles: [] }), '');
  assert.equal(getPortalHomePath({ roles: ['auditor'] }), '');
});

test('supported backend roles receive their dedicated dashboards', () => {
  assert.equal(getPortalHomePath({ roles: ['admin'] }), '/admin');
  assert.equal(getPortalHomePath({ roles: ['trainer'] }), '/trainer');
  assert.equal(getPortalHomePath({ roles: ['receptionist'] }), '/receptionist');
  assert.equal(getPortalHomePath({ roles: ['staff'] }), '/staff');
  assert.equal(getPortalHomePath({ roles: ['member'] }), '/member');
});

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
  assert.equal(isUserAllowedInPortal(user, '/membership'), true);
  assert.equal(isUserAllowedInPortal(user, '/payments'), false);
  assert.equal(isUserAllowedInPortal(user, '/modules/subscriptions'), false);
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

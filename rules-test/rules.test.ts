import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

// rules-unit-testing 은 compat API(db.ref(...).set(...))를 돌려준다. 읽기 쉽게 얇은 도우미로 감싼다.
type Db = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['database']>;
const ref = (db: Db, path?: string) => (path ? db.ref(path) : db.ref());
type Ref = ReturnType<typeof ref>;
const get = (r: Ref) => r.get();
const set = (r: Ref, v: unknown) => r.set(v);
const update = (r: Ref, v: object) => r.update(v);
const remove = (r: Ref) => r.remove();

// 실행: npm run test:rules  (Firebase 에뮬레이터 안에서 돈다)
const ADMIN = 'admin@example.com';
let env: RulesTestEnvironment;

const user = (uid: string) => env.authenticatedContext(uid).database();
const admin = () => env.authenticatedContext('admin-uid', { email: ADMIN }).database();
const anon = () => env.unauthenticatedContext().database();

async function setPhase(phase: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await set(ref(ctx.database(), 'state'), { phase, updatedAt: 1 });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bnw',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await setPhase('round1');
});

describe('state', () => {
  it('누구나 읽을 수 있다', async () => {
    await assertSucceeds(get(ref(anon(), 'state')));
  });
  it('진행자만 쓸 수 있다', async () => {
    await assertFails(set(ref(user('alice'), 'state'), { phase: 'ended', updatedAt: 2 }));
    await assertFails(set(ref(anon(), 'state'), { phase: 'ended', updatedAt: 2 }));
    await assertFails(set(ref(env.authenticatedContext('x', { email: 'other@example.com' }).database(), 'state'), { phase: 'ended', updatedAt: 2 }));
    await assertSucceeds(set(ref(admin(), 'state'), { phase: 'closed1', updatedAt: 2 }));
  });
  it('정해진 단계 이름만 받는다', async () => {
    await assertFails(set(ref(admin(), 'state'), { phase: 'party', updatedAt: 2 }));
    await assertFails(set(ref(admin(), 'state'), { phase: 'round1', updatedAt: 2, extra: 1 }));
  });
});

describe('responses', () => {
  it('본인 uid 에는 쓸 수 있고 남의 uid 에는 쓸 수 없다', async () => {
    await assertSucceeds(update(ref(user('alice'), 'responses/round1/alice'), { q1: true, at: 10 }));
    await assertFails(update(ref(user('alice'), 'responses/round1/bob'), { q1: true, at: 10 }));
    await assertFails(set(ref(anon(), 'responses/round1/alice/q2'), true));
  });
  it('같은 문항은 두 번 쓸 수 없고, 지울 수도 없다', async () => {
    await assertSucceeds(update(ref(user('alice'), 'responses/round1/alice'), { q1: true, at: 10 }));
    await assertFails(update(ref(user('alice'), 'responses/round1/alice'), { q1: false, at: 11 }));
    await assertFails(set(ref(user('alice'), 'responses/round1/alice/q1'), false));
    await assertFails(remove(ref(user('alice'), 'responses/round1/alice/q1')));
    await assertFails(remove(ref(user('alice'), 'responses/round1/alice')));
    // 다른 문항은 이어서 쓸 수 있다(부분 저장)
    await assertSucceeds(update(ref(user('alice'), 'responses/round1/alice'), { q2: false, at: 12 }));
  });
  it('boolean 과 q1~q4 만 받는다', async () => {
    await assertFails(set(ref(user('alice'), 'responses/round1/alice/q1'), 'yes'));
    await assertFails(set(ref(user('alice'), 'responses/round1/alice/q5'), true));
    await assertFails(set(ref(user('alice'), 'responses/round1/alice/name'), '김'));
    await assertFails(set(ref(user('alice'), 'responses/round3/alice/q1'), true));
  });
  it('닫힌 라운드에는 쓸 수 없다', async () => {
    await assertFails(update(ref(user('alice'), 'responses/round2/alice'), { q4: true, at: 10 }));
    for (const phase of ['waiting', 'closed1', 'round2', 'ended']) {
      await setPhase(phase);
      await assertFails(update(ref(user('alice'), 'responses/round1/alice'), { q1: true, at: 10 }));
    }
  });
  it('재심사는 round2 단계에서 q4 만, 한 번만 쓸 수 있다', async () => {
    await setPhase('round2');
    await assertSucceeds(update(ref(user('alice'), 'responses/round2/alice'), { q4: false, at: 10 }));
    await assertFails(update(ref(user('alice'), 'responses/round2/alice'), { q4: true, at: 11 }));
    await assertFails(set(ref(user('bob'), 'responses/round2/bob/q1'), true));
    await setPhase('ended');
    await assertFails(update(ref(user('bob'), 'responses/round2/bob'), { q4: true, at: 10 }));
  });
  it('로그인한 사용자만 읽을 수 있다', async () => {
    await assertSucceeds(get(ref(user('alice'), 'responses')));
    await assertFails(get(ref(anon(), 'responses')));
  });
});

describe('presence', () => {
  it('본인만 쓰고 모두 읽는다', async () => {
    await assertSucceeds(set(ref(user('alice'), 'presence/alice'), true));
    await assertSucceeds(remove(ref(user('alice'), 'presence/alice')));
    await assertFails(set(ref(user('alice'), 'presence/bob'), true));
    await assertFails(set(ref(user('alice'), 'presence/alice'), 'hi'));
    await assertSucceeds(get(ref(anon(), 'presence')));
  });
});

describe('전체 초기화', () => {
  it('진행자는 응답·접속을 모두 지우고 단계를 되돌릴 수 있다', async () => {
    await update(ref(user('alice'), 'responses/round1/alice'), { q1: true, at: 10 });
    await set(ref(user('alice'), 'presence/alice'), true);
    await assertSucceeds(update(ref(admin()), { state: { phase: 'waiting', updatedAt: 3 }, responses: null, presence: null }));
    const snap = await get(ref(admin(), 'responses'));
    if (snap.exists()) throw new Error('응답이 남아 있다');
  });
  it('진행자도 응답을 지어낼 수는 없고, 일반 사용자는 초기화할 수 없다', async () => {
    await assertFails(set(ref(admin(), 'responses/round1/alice/q1'), true));
    await assertFails(remove(ref(user('alice'), 'responses')));
    await assertFails(update(ref(user('alice')), { state: { phase: 'waiting', updatedAt: 3 }, responses: null, presence: null }));
  });
});

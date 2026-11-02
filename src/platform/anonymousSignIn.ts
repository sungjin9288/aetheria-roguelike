/**
 * 익명 로그인은 한 Auth에 한 번만 보낸다(2026-11 출시 전 점검).
 *
 * 개발 모드의 React StrictMode는 부트 이펙트를 두 번 돌린다. 두 번 모두 `signInAnonymously`를 부르면 Firebase가 익명 사용자를
 * 둘 만들고, 앱이 고른 uid와 실제 로그인한 사용자(`auth.currentUser`)가 달라져 자기 문서 읽기 · 쓰기가 모두 거부됐다
 * ('클라우드 연결 실패'). 진행 중인 요청을 나눠 쓰고, 이미 로그인한 사용자가 있으면 그 사용자를 쓴다. 실패하면 다음 부트가
 * 다시 시도할 수 있게 비운다.
 */
import { signInAnonymously, type Auth, type UserCredential } from 'firebase/auth';

type SignIn = (auth: Auth) => Promise<Pick<UserCredential, 'user'>>;

let inFlight: { auth: Auth; promise: Promise<string> } | null = null;

export const signInAnonymouslyOnce = (auth: Auth, signIn: SignIn = signInAnonymously): Promise<string> => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
    if (inFlight?.auth === auth) return inFlight.promise;
    const promise = signIn(auth).then((cred) => cred.user.uid);
    inFlight = { auth, promise };
    promise.then(
        () => { if (inFlight?.promise === promise) inFlight = null; },
        () => { if (inFlight?.promise === promise) inFlight = null; },
    );
    return promise;
};
